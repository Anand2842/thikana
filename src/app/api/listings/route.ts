import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateListing, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { fetchListings, mapListing } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";
export async function GET(req: Request) {
  try {
    let rows = await fetchListings();
    const loc = new URL(req.url).searchParams.get("locality");
    if (loc && loc !== "All") rows = rows.filter((l) => l.locality === loc);
    return NextResponse.json({ listings: rows });
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
    limit: 10,
    windowMs: 60000,
    key: `listings:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateListing(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified,cities")
      .eq("id", brokerId)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        {
          error:
            "Your broker application must be approved before listing homes.",
        },
        { status: 403 },
      );
    if (!broker.cities.includes(text(b.city)))
      return invalid(["Choose a city in your approved service area."]);
    // ponytail: exact normalized addresses share an ID; staff reviews ambiguous address matches.
    const identity = [b.city, b.locality, b.address]
      .map((v) =>
        text(v)
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]/gu, ""),
      )
      .join("|");
    const propId = `PROP-${createHash("sha256").update(identity).digest("hex").slice(0, 16).toUpperCase()}`;
    const row = {
      id: `L-${crypto.randomUUID()}`,
      prop_id: propId,
      title: text(b.title),
      city: text(b.city),
      locality: text(b.locality),
      sector: text(b.sector).slice(0, 100),
      bhk: b.bhk,
      type: b.type,
      rent: b.rent,
      deposit: b.deposit,
      brok_days: b.brokDays,
      brok: `${b.brokDays} days`,
      visit_fee: b.visitFee,
      visit_fee_refundable: b.visitFeeRefundable === true,
      other_fee: b.otherFee,
      other_fee_note: text(b.otherFeeNote).slice(0, 500),
      area: b.area,
      floor: text(b.floor).slice(0, 100),
      furnishing: b.furnishing,
      avail: b.avail,
      description: text(b.desc),
      amenities: text(b.amenities)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
      photos: b.photos,
      photo_hashes: Array.isArray(b.photoHashes) ? b.photoHashes : [],
      broker_id: brokerId,
      owner_name: text(b.ownerName).slice(0, 100),
      owner_relationship: text(b.ownerRelationship),
      // Reachable only after validateListing accepts authorized as true/"on"/"true";
      // derive (don't hardcode) so a direct RPC caller can't self-assert either.
      owner_authorized:
        b.authorized === true ||
        b.authorized === "on" ||
        b.authorized === "true",
      verification: "pending",
      availability_status: "Available",
      last_confirmed_at: new Date().toISOString(),
    };
    const { data, error } = await db.rpc("submit_listing", {
      payload: row,
      address: text(b.address),
    });
    if (error) throw error;
    // Duplicate-photo check: same photo URL(s) OR same uploaded file bytes
    // reused under a different property ID. Byte hashes catch re-uploaded
    // copies under new URLs; resized/cropped variants remain a manual-review
    // gap. Keeps verification pending; staff reviews the system report.
    // Never fails the listing insert.
    try {
      const urls = Array.isArray(b.photos)
        ? (b.photos as unknown[]).filter(
            (u): u is string => typeof u === "string" && u.length > 0,
          )
        : [];
      const hashes = Array.isArray(b.photoHashes)
        ? (b.photoHashes as unknown[]).filter(
            (h): h is string => typeof h === "string" && h.length > 0,
          )
        : [];
      const matched = new Map<string, string>();
      if (urls.length) {
        const { data: dupes } = await db
          .from("listings")
          .select("id,prop_id")
          .overlaps("photos", urls)
          .neq("prop_id", propId);
        for (const r of (dupes ?? []) as { prop_id: string }[])
          matched.set(r.prop_id, "Exact photo URL match");
      }
      if (hashes.length) {
        const { data: dupes } = await db
          .from("listings")
          .select("id,prop_id")
          .overlaps("photo_hashes", hashes)
          .neq("prop_id", propId);
        for (const r of (dupes ?? []) as { prop_id: string }[])
          if (!matched.has(r.prop_id))
            matched.set(r.prop_id, "Identical photo file match");
      }
      if (matched.size) {
        const propIds = [...matched.keys()];
        const kinds = [...new Set(matched.values())].join(" + ");
        await db.from("reports").insert({
          id: `R-${crypto.randomUUID()}`,
          listing_id: (data as { id: string }).id,
          reason: "Duplicate photos",
          details: `${kinds} with ${propIds.length} existing listing(s) under different propert${propIds.length === 1 ? "y" : "ies"}: ${propIds.join(", ")}`,
          reporter: "System · hash-match",
          status: "Open",
          date: new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        });
      }
    } catch {
      // photo-duplicate check is best-effort; listing insert already succeeded
    }
    return NextResponse.json({ listing: mapListing(data) }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
