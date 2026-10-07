import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import {
  ASSET_MIMES,
  MAX_ASSET_BYTES,
  MAX_PHOTOS_PER_DRAFT,
  MAX_SCREENSHOTS_PER_DRAFT,
  MEDIA_BUCKET,
  type AssetKind,
} from "@/lib/inventory-media";
import { checkRateLimit } from "@/lib/ratelimit";

// List a draft's own uploads (assignment tray + resume after reload).
export async function GET(req: Request) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const draftId = new URL(req.url).searchParams.get("draftId") ?? "";
  if (!draftId) return invalid(["Draft is required."]);
  try {
    const db = createServiceClient();
    const { data: draft, error: de } = await db
      .from("listing_drafts")
      .select("id")
      .eq("id", draftId)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (de) throw de;
    if (!draft)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const { data: assets, error: ae } = await db
      .from("inventory_assets")
      .select("id,kind,state,mime,bytes,position")
      .eq("draft_id", draftId)
      .eq("broker_id", brokerId)
      .order("position");
    if (ae) throw ae;
    return NextResponse.json({ assets: assets ?? [] });
  } catch (e) {
    return unavailable(e);
  }
}

// Reserve an upload slot: the server chooses the immutable object path and
// issues a signed upload token for exactly that path. Quota (count, bytes,
// MIME) is reserved before signing so a refresh cannot bypass budgets.
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
    key: `asset-reserve:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  const draftId = typeof b.draftId === "string" ? b.draftId : "";
  const kind: AssetKind | null =
    b.kind === "photo" || b.kind === "screenshot" ? b.kind : null;
  const mime = typeof b.mime === "string" ? b.mime : "";
  const bytes = typeof b.bytes === "number" ? b.bytes : 0;
  if (!draftId || !kind) return invalid(["Draft and photo/screenshot kind are required."]);
  if (!(ASSET_MIMES as readonly string[]).includes(mime))
    return invalid(["Choose a JPEG, PNG or WEBP photo. HEIC is not supported."]);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_ASSET_BYTES)
    return invalid(["Photo must be under 5 MB."]);
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
      .select("id,submitted_listing_id")
      .eq("id", draftId)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (de) throw de;
    if (!draft)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if (
      typeof (draft as Record<string, unknown>).submitted_listing_id === "string" &&
      (draft as Record<string, unknown>).submitted_listing_id
    )
      return NextResponse.json(
        { error: "Already submitted — edit the listing instead." },
        { status: 409 },
      );
    const cap =
      kind === "photo" ? MAX_PHOTOS_PER_DRAFT : MAX_SCREENSHOTS_PER_DRAFT;
    const { count } = await db
      .from("inventory_assets")
      .select("id", { count: "exact", head: true })
      .eq("draft_id", draftId)
      .eq("kind", kind)
      .neq("state", "failed")
      .gt("reserved_until", new Date().toISOString());
    if ((count ?? 0) >= cap)
      return NextResponse.json(
        { error: `Only ${cap} ${kind === "photo" ? "photos" : "screenshots"} per home.` },
        { status: 409 },
      );
    const { data: existing } = await db
      .from("inventory_assets")
      .select("position")
      .eq("draft_id", draftId)
      .order("position", { ascending: false })
      .limit(1);
    const assetId = `A-${crypto.randomUUID()}`;
    const path = `${brokerId}/${draftId}/${assetId}`;
    const { data: row, error: ie } = await db
      .from("inventory_assets")
      .insert({
        id: assetId,
        broker_id: brokerId,
        draft_id: draftId,
        kind,
        storage_path: path,
        mime,
        bytes: Math.floor(bytes),
        position: ((existing?.[0] as { position?: number } | undefined)?.position ?? -1) + 1,
      })
      .select("id")
      .single();
    if (ie) throw ie;
    const { data: token, error: te } = await db.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path);
    if (te) throw te;
    return NextResponse.json(
      { asset: { id: assetId }, token: token.token, path },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
