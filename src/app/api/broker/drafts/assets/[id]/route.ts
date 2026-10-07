import { NextResponse } from "next/server";
import { authorize, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { MEDIA_BUCKET } from "@/lib/inventory-media";

// Detach an upload: only the owning broker, only before submission. Removes
// the row and the stored bytes together — a removed photo leaves nothing.
export async function DELETE(
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
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data, error: fe } = await db
      .from("inventory_assets")
      .select("id,storage_path,draft_id")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (fe) throw fe;
    if (!data)
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    const row = data as { id: string; storage_path: string; draft_id: string | null };
    if (row.draft_id) {
      const { data: draft } = await db
        .from("listing_drafts")
        .select("submitted_listing_id")
        .eq("id", row.draft_id)
        .maybeSingle();
      const sub = (draft as Record<string, unknown> | null)?.submitted_listing_id;
      if (typeof sub === "string" && sub)
        return NextResponse.json(
          { error: "Already submitted — edit the listing instead." },
          { status: 409 },
        );
    }
    const { error: del } = await db
      .from("inventory_assets")
      .delete()
      .eq("id", row.id);
    if (del) throw del;
    await db.storage.from(MEDIA_BUCKET).remove([row.storage_path]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
