import { NextResponse } from "next/server";
import { authorize, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import {
  MAX_ASSET_BYTES,
  MEDIA_BUCKET,
  sha256,
  sniffMime,
  type AssetRow,
} from "@/lib/inventory-media";
import { checkRateLimit } from "@/lib/ratelimit";

// Mark an upload complete: download the stored bytes server-side and verify
// size, magic-byte MIME and SHA-256 before trusting the asset. A client hash
// or an uploaded object alone never marks an asset usable.
export async function POST(
  _req: Request,
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
  const limited = checkRateLimit(_req, {
    limit: 20,
    windowMs: 60000,
    key: `asset-complete:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data, error: fe } = await db
      .from("inventory_assets")
      .select("*")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (fe) throw fe;
    const asset = data as AssetRow | null;
    if (!asset)
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    if (asset.state === "ready")
      return NextResponse.json({ asset: { id: asset.id, state: "ready" } });
    const fail = async (message: string) => {
      await db
        .from("inventory_assets")
        .update({ state: "failed" })
        .eq("id", asset.id);
      await db.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
      return NextResponse.json({ error: message }, { status: 400 });
    };
    const { data: blob, error: de } = await db.storage
      .from(MEDIA_BUCKET)
      .download(asset.storage_path);
    if (de || !blob) return fail("Upload did not arrive. Reselect the photo.");
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_ASSET_BYTES)
      return fail("Photo must be under 5 MB.");
    const actual = sniffMime(buf);
    if (!actual)
      return fail("Choose a JPEG, PNG or WEBP photo. HEIC is not supported.");
    const { error: ue } = await db
      .from("inventory_assets")
      .update({
        state: "ready",
        mime: actual,
        bytes: buf.length,
        sha256: sha256(buf),
      })
      .eq("id", asset.id);
    if (ue) throw ue;
    return NextResponse.json({
      asset: { id: asset.id, state: "ready", mime: actual, bytes: buf.length },
    });
  } catch (e) {
    return unavailable(e);
  }
}
