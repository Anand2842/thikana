import "server-only";
import { createServiceClient } from "./supabase/server";
import { mapListing } from "./supabase/data";

export interface ReviewItem {
  id: string;
  propId: string;
  title: string;
  bhk: number;
  rent: number;
  locality: string;
  building: string | null;
  requestId: string | null;
  fees: {
    brokDays: number;
    visitFee: number;
    visitFeeRefundable: boolean;
    otherFee: number;
    otherFeeNote: string;
  };
  photos: number;
  duplicatePhotoReports: number;
  sameHomeOtherListings: number;
}

export interface ReviewGroup {
  brokerId: string;
  brokerName: string;
  items: ReviewItem[];
}

// Grouped moderation queue: pending listings clustered by broker with the
// fee/photo/duplicate differences a reviewer needs. Approvals still go
// through the atomic moderate_listing path one listing at a time.
export async function fetchReviewQueue(
  db: ReturnType<typeof createServiceClient> = createServiceClient(),
): Promise<ReviewGroup[]> {
  const { data: rows, error: le } = await db
    .from("listings")
    .select("*")
    .eq("verification", "pending")
    .order("created_at", { ascending: true });
  if (le) throw le;
  const listings = (rows ?? []).map(mapListing);
  if (!listings.length) return [];
  const brokerIds = [...new Set(listings.map((l) => l.brokerId))];
  const { data: brokers } = await db
    .from("brokers")
    .select("id,name,agency")
    .in("id", brokerIds);
  const brokerById = new Map(
    ((brokers ?? []) as { id: string; name: string; agency: string }[]).map(
      (b) => [b.id, b],
    ),
  );
  const draftIds = listings
    .map((l) => l.sourceDraftId)
    .filter((d): d is string => !!d);
  const { data: drafts } = draftIds.length
    ? await db.from("listing_drafts").select("id,building_id").in("id", draftIds)
    : { data: [] };
  const buildingByDraft = new Map<string, string>();
  const buildingIds = [
    ...new Set(
      ((drafts ?? []) as { id: string; building_id: string | null }[])
        .filter((d) => d.building_id)
        .map((d) => {
          buildingByDraft.set(d.id, d.building_id as string);
          return d.building_id as string;
        }),
    ),
  ];
  const { data: buildings } = buildingIds.length
    ? await db.from("broker_buildings").select("id,label").in("id", buildingIds)
    : { data: [] };
  const labelByBuilding = new Map(
    ((buildings ?? []) as { id: string; label: string }[]).map((b) => [
      b.id,
      b.label,
    ]),
  );
  const listingIds = listings.map((l) => l.id);
  const { data: dupReports } = await db
    .from("reports")
    .select("listing_id")
    .in("listing_id", listingIds)
    .eq("reason", "Duplicate photos")
    .like("status", "Open%");
  const dupByListing = new Map<string, number>();
  for (const r of (dupReports ?? []) as { listing_id: string }[])
    dupByListing.set(r.listing_id, (dupByListing.get(r.listing_id) ?? 0) + 1);
  const propIds = [...new Set(listings.map((l) => l.propId))];
  const { data: siblings } = await db
    .from("listings")
    .select("prop_id,broker_id")
    .in("prop_id", propIds);
  const siblingCount = new Map<string, number>();
  for (const s of (siblings ?? []) as { prop_id: string; broker_id: string }[]) {
    const key = `${s.prop_id}|${s.broker_id}`;
    siblingCount.set(key, (siblingCount.get(key) ?? 0) + 1);
  }
  const groups = new Map<string, ReviewGroup>();
  for (const l of listings) {
    const broker = brokerById.get(l.brokerId);
    const buildingId =
      (l.sourceDraftId && buildingByDraft.get(l.sourceDraftId)) || null;
    const item: ReviewItem = {
      id: l.id,
      propId: l.propId,
      title: l.title,
      bhk: l.bhk,
      rent: l.rent,
      locality: l.locality,
      building: buildingId ? (labelByBuilding.get(buildingId) ?? null) : null,
      requestId: l.sourceRequestId ?? null,
        fees: {
          brokDays: l.brokDays,
          visitFee: l.visitFee,
          visitFeeRefundable: l.visitFeeRefundable ?? false,
          otherFee: l.otherFee,
          otherFeeNote: l.otherFeeNote ?? "",
        },
      photos: l.photos.length,
      duplicatePhotoReports: dupByListing.get(l.id) ?? 0,
      sameHomeOtherListings:
        (siblingCount.get(`${l.propId}|${l.brokerId}`) ?? 1) - 1,
    };
    const g = groups.get(l.brokerId) ?? {
      brokerId: l.brokerId,
      brokerName: broker ? `${broker.name} · ${broker.agency}` : l.brokerId,
      items: [],
    };
    g.items.push(item);
    groups.set(l.brokerId, g);
  }
  return [...groups.values()];
}
