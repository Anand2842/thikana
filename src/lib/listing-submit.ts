import "server-only";
import { createHash } from "node:crypto";
import { validateListing, text } from "./validation";
import { createServiceClient } from "./supabase/server";
import { mapListing } from "./supabase/data";
import type { Listing } from "./mock-data";

// Single shared listing-submission operation used by both the full listing
// form and draft submission. Extracted verbatim from the original route so
// behavior (validation, broker/city gates, property identity, duplicate
// checks, atomic insert) is identical for every caller.
export interface SubmitInput {
  body: Record<string, unknown>;
  brokerId: string;
  sourceDraftId?: string;
}

export function submitValidationErrors(b: Record<string, unknown>): string[] {
  return validateListing(normalizeSubmitBody(b));
}

// Building snapshots store amenities as an array; the listing contract
// takes a comma-separated string. Normalize before validating or saving so
// snapshot-sourced drafts submit without retyping.
export function normalizeSubmitBody(b: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(b.amenities))
    return {
      ...b,
      amenities: (b.amenities as unknown[]).map((a) => String(a)).join(", "),
    };
  return b;
}

export async function submitListing({
  body: rawBody,
  brokerId,
  sourceDraftId,
}: SubmitInput): Promise<{ listing: Listing }> {
  const b = normalizeSubmitBody(rawBody);
  const db = createServiceClient();
  const { data: broker, error: be } = await db
    .from("brokers")
    .select("verified,cities")
    .eq("id", brokerId)
    .single();
  if (be) throw be;
  if (broker.verified !== "verified")
    throw Object.assign(
      new Error("Your broker application must be approved before listing homes."),
      { status: 403 },
    );
  if (!broker.cities.includes(text(b.city)))
    throw Object.assign(
      new Error("Choose a city in your approved service area."),
      { status: 400, errors: ["Choose a city in your approved service area."] },
    );
  const { row, propId } = buildListingRow(b, brokerId, sourceDraftId);
  const { data, error } = await db.rpc("submit_listing", {
    payload: row,
    address: text(b.address),
  });
  if (error) throw error;
  await checkDuplicatePhotos(db, b, propId, (data as { id: string }).id);
  return { listing: mapListing(data) };
}

// Row builder shared by the single form and draft submission: identical
// property identity, fee mapping and authorization derivation for both.
export function buildListingRow(
  rawBody: Record<string, unknown>,
  brokerId: string,
  sourceDraftId?: string,
): { row: Record<string, unknown>; propId: string } {
  const b = normalizeSubmitBody(rawBody);
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
    revision: 1,
    ...(sourceDraftId ? { source_draft_id: sourceDraftId } : {}),
    last_confirmed_at: new Date().toISOString(),
  };
  return { row, propId };
}

// Duplicate-photo check shared by all submission paths: same photo URL(s)
// OR same uploaded file bytes reused under a different property ID. Byte
// hashes catch re-uploaded copies under new URLs; resized/cropped variants
// remain a manual-review gap. Keeps verification pending; staff reviews the
// system report. Never fails the listing insert.
export async function checkDuplicatePhotos(
  db: ReturnType<typeof createServiceClient>,
  b: Record<string, unknown>,
  propId: string,
  listingId: string,
): Promise<void> {
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
        listing_id: listingId,
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
}
