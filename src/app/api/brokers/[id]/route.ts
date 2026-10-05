import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, userRole } from "@/lib/supabase/role";
import { mapBroker } from "@/lib/supabase/data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "d MMM yyyy", e.g. "5 Oct 2026"
function todayStamp(): string {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userRole(user) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { action } = body;
  if (action !== "approve" && action !== "reject" && action !== "suspend") {
    return NextResponse.json({ error: 'Invalid action. Use "approve" | "reject" | "suspend".' }, { status: 400 });
  }

  const sb = createServiceClient();

  if (action === "reject") {
    const { data, error } = await sb.from("brokers").delete().eq("id", id).select().single();
    if (error || !data) return NextResponse.json({ error: "Broker not found" }, { status: 404 });
    return NextResponse.json({ broker: mapBroker(data) });
  }

  const patch =
    action === "approve" ? { verified: "verified", vdate: todayStamp() } : { verified: "suspended" };
  const { data, error } = await sb.from("brokers").update(patch).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ error: "Broker not found" }, { status: 404 });
  return NextResponse.json({ broker: mapBroker(data) });
}
