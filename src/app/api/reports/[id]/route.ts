import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, userRole } from "@/lib/supabase/role";
import { mapReport } from "@/lib/supabase/data";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userRole(user) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { uphold } = body;
  if (typeof uphold !== "boolean") {
    return NextResponse.json({ error: 'Invalid body. Expected { "uphold": boolean }.' }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: existing, error: fetchError } = await sb.from("reports").select("*").eq("id", id).single();
  if (fetchError || !existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const listingId = existing.listing_id as string;
  if (uphold) {
    const { error: flagError } = await sb
      .from("listings")
      .update({ verification: "flagged" })
      .eq("id", listingId);
    if (flagError) return NextResponse.json({ error: "Failed to flag listing" }, { status: 500 });
  }

  const status = uphold ? "Resolved · upheld" : "Resolved · dismissed";
  const { data, error } = await sb.from("reports").update({ status }).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 });
  return NextResponse.json({ report: mapReport(data), listingId });
}
