import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, userRole } from "@/lib/supabase/role";
import { mapListing } from "@/lib/supabase/data";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userRole(user) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { action } = body;
  if (action !== "approve" && action !== "expire" && action !== "flag") {
    return NextResponse.json({ error: 'Invalid action. Use "approve" | "expire" | "flag".' }, { status: 400 });
  }

  const patch =
    action === "approve"
      ? { verification: "verified", hrs: 0 }
      : action === "expire"
        ? { verification: "stale", hrs: 400 }
        : { verification: "flagged" };

  const sb = createServiceClient();
  const { data, error } = await sb.from("listings").update(patch).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json({ listing: mapListing(data) });
}
