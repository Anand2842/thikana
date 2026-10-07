import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { validateDraftFields } from "@/lib/inventory";

function mapDraft(r: Record<string, unknown>) {
  return {
    id: r.id,
    buildingId: r.building_id ?? null,
    fields: r.fields ?? {},
    confirmations: r.confirmations ?? {},
    revision: r.revision ?? 1,
    archived: r.archived ?? false,
    submittedListingId: r.submitted_listing_id ?? null,
    updatedAt: r.updated_at,
  };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const { id } = await ctx.params,
    b = await body(req);
  const expectedRevision =
    typeof b.expectedRevision === "number" ? b.expectedRevision : null;
  if (expectedRevision === null)
    return invalid(["Send the expected revision you edited."]);
  try {
    const db = createServiceClient();
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified")
      .eq("id", brokerId)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        { error: "Draft workspace unlocks after approval." },
        { status: 403 },
      );
    const { data: draft, error: de } = await db
      .from("listing_drafts")
      .select("*")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (de) throw de;
    if (!draft)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });

    // Duplicate: new unit identity, property-specific facts unconfirmed.
    // Never copies permission (including every equivalent representation),
    // owner identity, verification state, property IDs, enquiries or reviews
    // (drafts hold none of those by construction). Source revision must match
    // so a stale screen can't duplicate a draft it can no longer see.
    if (b.duplicate === true) {
      const src = draft as Record<string, unknown>;
      if (src.revision !== expectedRevision)
        return NextResponse.json(
          { error: "Draft changed. Refresh and try again." },
          { status: 409 },
        );
      const fields = { ...(src.fields as Record<string, unknown>) };
      delete fields.address;
      delete fields.unit;
      delete fields.photos;
      delete fields.photoHashes;
      delete fields.authorized;
      delete fields.ownerName;
      const { data: copy, error: ce } = await db
        .from("listing_drafts")
        .insert({
          id: `D-${crypto.randomUUID()}`,
          broker_id: brokerId,
          building_id: (draft as Record<string, unknown>).building_id ?? null,
          fields,
          confirmations: {},
        })
        .select()
        .single();
      if (ce) throw ce;
      return NextResponse.json(
        { draft: mapDraft(copy as Record<string, unknown>) },
        { status: 201 },
      );
    }

    if (typeof b.archived === "boolean") {
      const { data: archived, error: ae } = await db
        .from("listing_drafts")
        .update({
          archived: b.archived,
          revision: expectedRevision + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("broker_id", brokerId)
        .eq("revision", expectedRevision)
        .select()
        .maybeSingle();
      if (ae) throw ae;
      if (!archived)
        return NextResponse.json(
          { error: "Draft changed. Refresh and try again." },
          { status: 409 },
        );
      return NextResponse.json({
        draft: mapDraft(archived as Record<string, unknown>),
      });
    }

    const dr = draft as Record<string, unknown>;
    // Submitted drafts are frozen: further changes go through the listing
    // edit path (which triggers re-review), never by editing history.
    if (typeof dr.submitted_listing_id === "string" && dr.submitted_listing_id) {
      return NextResponse.json(
        { error: "Already submitted — edit the listing instead." },
        { status: 409 },
      );
    }

    // Partial save: merge provided fields + confirmations over stored ones.
    const stored = dr.fields as Record<string, unknown>;
    const storedConf = dr.confirmations as Record<string, unknown>;
    const nextFields = { ...stored };
    if (b.fields !== undefined) {
      if (typeof b.fields !== "object" || b.fields === null || Array.isArray(b.fields))
        return invalid(["Draft fields must be an object."]);
      const errors = validateDraftFields(b.fields as Record<string, unknown>);
      if (errors.length) return invalid(errors);
      Object.assign(nextFields, b.fields as Record<string, unknown>);
    }
    const nextConf = { ...storedConf };
    if (b.confirmations !== undefined) {
      if (typeof b.confirmations !== "object" || b.confirmations === null || Array.isArray(b.confirmations))
        return invalid(["Confirmations must be an object."]);
      for (const [k, v] of Object.entries(b.confirmations as Record<string, unknown>)) {
        if (typeof v !== "boolean")
          return invalid([`Confirmation ${k} must be true or false.`]);
        nextConf[k] = v;
      }
    }
    // Material changes invalidate stale confirmations: a changed fee fact
    // un-confirms fees, a changed identity/authority fact un-confirms
    // authority. Only previously-present values count — newly added facts
    // don't punish the confirmation being recorded alongside them.
    const FEE_KEYS = ["rent", "deposit", "brokDays", "visitFee", "visitFeeRefundable", "otherFee", "otherFeeNote"];
    const AUTH_KEYS = ["address", "unit", "city", "locality", "ownerName", "authorized", "ownerRelationship"];
    const changed = (keys: string[]) =>
      keys.some(
        (k) =>
          k in stored &&
          JSON.stringify(stored[k]) !== JSON.stringify(nextFields[k]),
      );
    if (changed(FEE_KEYS)) nextConf.fees = false;
    if (changed(AUTH_KEYS)) nextConf.authority = false;
    const { data: updated, error } = await db
      .from("listing_drafts")
      .update({
        fields: nextFields,
        confirmations: nextConf,
        revision: expectedRevision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("broker_id", brokerId)
      .eq("revision", expectedRevision)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated)
      return NextResponse.json(
        { error: "Draft changed. Refresh and try again." },
        { status: 409 },
      );
    return NextResponse.json({
      draft: mapDraft(updated as Record<string, unknown>),
    });
  } catch (e) {
    return unavailable(e);
  }
}
