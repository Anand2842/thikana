import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import {
  buildListingRow,
  checkDuplicatePhotos,
  submitValidationErrors,
} from "@/lib/listing-submit";
import { mapListing } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

// Submit one draft as a pending listing. Atomic: the draft row is locked,
// checked, and linked in a single database transaction, with a partial
// unique index on listings.source_draft_id as backstop. A repeat returns
// the already-submitted listing; concurrent submits cannot create two.
export async function POST(
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
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `draft-submit:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params,
    b = await body(req);
  const expectedRevision =
    typeof b.expectedRevision === "number" ? b.expectedRevision : null;
  if (expectedRevision === null)
    return invalid(["Send the expected revision you are submitting."]);
  try {
    const db = createServiceClient();
    const { data: draft, error: de } = await db
      .from("listing_drafts")
      .select("fields,confirmations")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (de) throw de;
    if (!draft)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const dr = draft as Record<string, unknown>;
    const confirmations = (dr.confirmations ?? {}) as Record<string, unknown>;
    // Both current UI confirmations are required server-side. The shared
    // listing authorization field is derived from the accepted authority
    // confirmation — a stale/copied fields.authorized value is never trusted.
    if (confirmations.fees !== true || confirmations.authority !== true)
      return NextResponse.json(
        {
          error:
            "Confirm fees and owner permission on this draft before submitting.",
        },
        { status: 409 },
      );
    const fields = {
      ...((dr.fields ?? {}) as Record<string, unknown>),
      authorized: true,
    };
    const errors = submitValidationErrors(fields);
    if (errors.length) return invalid(errors);
    const { row, propId } = buildListingRow(fields, brokerId, id as string);
    const { data, error } = await db.rpc("submit_draft_listing", {
      p_draft_id: id,
      p_broker_id: brokerId,
      p_expected_revision: expectedRevision,
      p_listing: row,
      p_address: ((dr.fields ?? {}) as Record<string, unknown>).address as string,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (msg.includes("Already submitted")) {
        const { data: winner } = await db
          .from("listing_drafts")
          .select("submitted_listing_id")
          .eq("id", id)
          .maybeSingle();
        const winnerId = (winner as Record<string, unknown> | null)
          ?.submitted_listing_id as string | null;
        if (winnerId) {
          const { data: wl } = await db
            .from("listings")
            .select("*")
            .eq("id", winnerId)
            .maybeSingle();
          if (wl)
            return NextResponse.json({
              listing: mapListing(wl),
              duplicate: true,
            });
        }
      }
      if (msg.includes("Stale revision") || msg.includes("Archived"))
        return NextResponse.json({ error: msg }, { status: 409 });
      if (
        msg.includes("Draft not found") ||
        msg.includes("unlocks after approval")
      )
        return NextResponse.json(
          { error: msg },
          { status: msg.includes("not found") ? 404 : 403 },
        );
      throw error;
    }
    const saved = data as { id: string };
    await checkDuplicatePhotos(db, fields, propId, saved.id);
    const { data: listing } = await db
      .from("listings")
      .select("*")
      .eq("id", saved.id)
      .single();
    return NextResponse.json(
      { listing: mapListing(listing), duplicate: false },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
