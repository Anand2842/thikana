import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { validateDraftFields } from "@/lib/inventory";
import { checkRateLimit } from "@/lib/ratelimit";

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

export async function GET(req: Request) {
  // Reads allowed for any authenticated broker (even pending review) so
  // brokers can recover their own work.
  const { user, response } = await authorize();
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const sp = new URL(req.url).searchParams;
  const showArchived = sp.get("archived") === "1";
  const buildingId = sp.get("building") || "";
  try {
    let q = createServiceClient()
      .from("listing_drafts")
      .select("*")
      .eq("broker_id", brokerId)
      .eq("archived", showArchived)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (buildingId) q = q.eq("building_id", buildingId);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({
      drafts: (data ?? []).map((r) => mapDraft(r as Record<string, unknown>)),
    });
  } catch (e) {
    return unavailable(e);
  }
}

export async function POST(req: Request) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `drafts:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  const flat: Record<string, unknown> = {
    title: b.title,
    city: b.city,
    locality: b.locality,
    address: b.address,
    unit: b.unit,
    bhk: b.bhk,
    rent: b.rent,
    area: b.area,
    furnishing: b.furnishing,
    avail: b.avail,
  };
  const fields =
    b.fields !== undefined
      ? b.fields
      : Object.fromEntries(
          Object.entries(flat).filter(
            ([, v]) => v !== undefined && v !== "" && v !== null,
          ),
        );
  if (typeof fields !== "object" || fields === null || Array.isArray(fields))
    return invalid(["Draft fields must be an object."]);
  const errors = validateDraftFields(fields as Record<string, unknown>);
  if (errors.length) return invalid(errors);
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
    // Snapshot building context into the draft: later building edits must
    // not silently change existing drafts.
    let buildingId: string | null = null;
    const snapshot: Record<string, unknown> = {
      ...(fields as Record<string, unknown>),
    };
    if (typeof b.buildingId === "string" && b.buildingId) {
      const { data: building, error: bldErr } = await db
        .from("broker_buildings")
        .select("*")
        .eq("id", b.buildingId)
        .eq("broker_id", brokerId)
        .maybeSingle();
      if (bldErr) throw bldErr;
      if (!building)
        return NextResponse.json(
          { error: "Building not found." },
          { status: 404 },
        );
      buildingId = building.id as string;
      const bd = building as Record<string, unknown>;
      const defaults = (bd.defaults ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries({
        city: bd.city,
        locality: bd.locality,
        street: bd.street,
        sector: bd.sector,
        amenities: bd.amenities,
        ...defaults,
      }))
        if (snapshot[k] === undefined || snapshot[k] === "" || snapshot[k] === null)
          snapshot[k] = v;
      // Compose the full private address used by property matching when the
      // draft only carries a unit reference plus building context.
      if (!snapshot.address && (snapshot.street || snapshot.sector)) {
        const unit = typeof snapshot.unit === "string" ? snapshot.unit : "";
        snapshot.address = [unit, snapshot.street, snapshot.sector, snapshot.locality, snapshot.city]
          .map((p) => String(p ?? "").trim())
          .filter(Boolean)
          .join(", ");
      }
    }
    const { data, error } = await db
      .from("listing_drafts")
      .insert({
        id: `D-${crypto.randomUUID()}`,
        broker_id: brokerId,
        building_id: buildingId,
        fields: snapshot,
        confirmations: {},
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(
      { draft: mapDraft(data as Record<string, unknown>) },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
