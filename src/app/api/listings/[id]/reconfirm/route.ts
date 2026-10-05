import { NextResponse } from "next/server";
import { getListing } from "@/lib/mock-data";
import { createServiceClient } from "@/lib/supabase/server";
import { mapListing } from "@/lib/supabase/data";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("listings")
      .update({ hrs: 0, verification: "verified" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ listing: mapListing(data), source: "supabase" });
  } catch {
    const listing = getListing(id);
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    return NextResponse.json({
      listing: { ...listing, hrs: 0, verification: "verified" },
      source: "mock",
    });
  }
}
