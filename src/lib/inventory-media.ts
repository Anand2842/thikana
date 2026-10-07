import "server-only";
import { createHash } from "crypto";

// Slice 2 private media: every byte lives in the private inventory-media
// bucket; inventory_assets is the ownership ledger. Permanent photo identity
// is the /api/inventory-media/[id] route URL — never an expiring signed URL.

export const MEDIA_BUCKET = "inventory-media";
export const ASSET_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_DRAFT = 8;
export const MAX_SCREENSHOTS_PER_DRAFT = 3;

export type AssetKind = "photo" | "screenshot";
export type AssetRow = {
  id: string;
  broker_id: string;
  draft_id: string | null;
  kind: AssetKind;
  storage_path: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  state: "reserved" | "ready" | "failed";
  position: number;
};

export const mediaUrl = (id: string) => `/api/inventory-media/${id}`;

// Magic-byte check so a renamed .exe can never become a trusted asset.
// HEIC is deliberately unsupported: fail loudly, ask for JPEG/PNG/WEBP.
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

type Db = ReturnType<typeof import("@/lib/supabase/server").createServiceClient>;

// Ready photo assets for a draft, in assignment order. Screenshots are
// never included: they can never become listing photos automatically.
export async function resolveDraftPhotos(
  db: Db,
  draftId: string,
): Promise<{ urls: string[]; hashes: string[] }> {
  const { data } = await db
    .from("inventory_assets")
    .select("id,sha256")
    .eq("draft_id", draftId)
    .eq("kind", "photo")
    .eq("state", "ready")
    .order("position");
  const rows = (data ?? []) as { id: string; sha256: string | null }[];
  return {
    urls: rows.map((r) => mediaUrl(r.id)),
    hashes: rows.map((r) => r.sha256).filter((h): h is string => !!h),
  };
}

export type MediaScope = {
  role: string;
  brokerId: string | null;
  aal2: boolean;
};

// Mirrors the listing visibility rule: a photo is public exactly when its
// listing is public (verification <> 'pending'). Screenshots and
// draft-stage/pending photos need the owning broker or an MFA reviewer.
export function viewDecision(
  asset: AssetRow,
  listingVerification: string | null,
  scope: MediaScope,
): { ok: boolean; public: boolean } {
  const owner = scope.brokerId !== null && scope.brokerId === asset.broker_id;
  const reviewer = scope.role === "admin" && scope.aal2;
  if (asset.kind === "screenshot") return { ok: owner || reviewer, public: false };
  if (listingVerification !== null && listingVerification !== "pending")
    return { ok: true, public: true };
  return { ok: owner || reviewer, public: false };
}
