import { NextResponse } from "next/server";
import { unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getAssurance,
  getSessionUser,
  userBrokerId,
  userRole,
} from "@/lib/supabase/role";
import { MEDIA_BUCKET, viewDecision, type AssetRow } from "@/lib/inventory-media";

// Authorised photo access. Screenshots are owner/MFA-reviewer only and never
// pass through the public path. Property photos are public exactly when the
// linked listing is public (verification <> 'pending'); draft-stage and
// pending photos need the owning broker or an MFA reviewer. Already-issued
// responses carry bounded cache lifetimes, not instant revocation.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data, error: fe } = await db
      .from("inventory_assets")
      .select("*")
      .eq("id", id)
      .eq("state", "ready")
      .maybeSingle();
    if (fe) throw fe;
    const asset = data as AssetRow | null;
    if (!asset)
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    let listingVerification: string | null = null;
    if (asset.kind === "photo" && asset.draft_id) {
      const { data: listing } = await db
        .from("listings")
        .select("verification")
        .eq("source_draft_id", asset.draft_id)
        .maybeSingle();
      listingVerification =
        (listing as { verification?: string } | null)?.verification ?? null;
    }
    const user = await getSessionUser().catch(() => null);
    const { current } = user
      ? await getAssurance().catch(() => ({ current: null }))
      : { current: null };
    const decision = viewDecision(asset, listingVerification, {
      role: user ? userRole(user) : "seeker",
      brokerId: userBrokerId(user),
      aal2: current === "aal2",
    });
    if (!decision.ok)
      return NextResponse.json(
        { error: user ? "You do not have access to this photo." : "Sign in to continue." },
        { status: user ? 403 : 401 },
      );
    const { data: blob, error: de } = await db.storage
      .from(MEDIA_BUCKET)
      .download(asset.storage_path);
    if (de || !blob)
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    const buf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(buf.length),
        "Cache-Control": decision.public
          ? "public, max-age=86400"
          : "private, max-age=300",
      },
    });
  } catch (e) {
    return unavailable(e);
  }
}
