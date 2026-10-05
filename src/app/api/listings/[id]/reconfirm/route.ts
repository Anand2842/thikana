import { NextResponse } from "next/server";
import { authorize, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId, userRole } from "@/lib/supabase/role";
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data: l, error } = await db
      .from("listings")
      .select("broker_id,verification")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!l)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    if (userRole(user) !== "admin" && l.broker_id !== userBrokerId(user))
      return NextResponse.json(
        { error: "This is not your listing." },
        { status: 403 },
      );
    if (!["verified", "stale"].includes(l.verification))
      return NextResponse.json(
        { error: "A flagged or pending listing needs admin review." },
        { status: 409 },
      );
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified")
      .eq("id", l.broker_id)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        { error: "Broker approval is required." },
        { status: 409 },
      );
    // Conditional update prevents reconfirmation racing with moderation.
    const { data, error: save } = await db
      .from("listings")
      .update({
        hrs: 0,
        last_confirmed_at: new Date().toISOString(),
        verification: "verified",
      })
      .eq("id", id)
      .in("verification", ["verified", "stale"])
      .select("id");
    if (save) throw save;
    if (!data.length)
      return NextResponse.json(
        { error: "Listing changed. Refresh and try again." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
