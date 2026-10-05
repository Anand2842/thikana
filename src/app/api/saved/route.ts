import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const b = await body(req);
  if (!text(b.listingId) || typeof b.saved !== "boolean")
    return invalid(["Choose a listing to save."]);
  try {
    const db = createServiceClient();
    const { data: l, error: e } = await db
      .from("listings")
      .select("id,verification")
      .eq("id", text(b.listingId))
      .maybeSingle();
    if (e) throw e;
    if (!l || l.verification === "pending")
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    const q = b.saved
      ? db
          .from("saved_listings")
          .upsert({ owner_id: user!.id, listing_id: l.id })
      : db
          .from("saved_listings")
          .delete()
          .eq("owner_id", user!.id)
          .eq("listing_id", l.id);
    const { error } = await q;
    if (error) throw error;
    return NextResponse.json({ saved: b.saved });
  } catch (e) {
    return unavailable(e);
  }
}
