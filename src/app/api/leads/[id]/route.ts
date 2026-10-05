import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { LEAD_STAGES } from "@/lib/trust";
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const { id } = await ctx.params,
    b = await body(req);
  try {
    const db = createServiceClient();
    const { data: l, error } = await db
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!l)
      return NextResponse.json(
        { error: "Enquiry not found." },
        { status: 404 },
      );
    const owner = l.owner_id === user!.id,
      broker = l.broker_id === userBrokerId(user),
      admin = userRole(user) === "admin";
    if (!owner && !broker && !admin)
      return NextResponse.json(
        { error: "This enquiry does not belong to you." },
        { status: 403 },
      );
    const patch: Record<string, unknown> = {};
    if (b.action === "schedule") {
      const at = Date.parse(text(b.visitAt));
      if (
        !Number.isFinite(at) ||
        at < Date.now() ||
        at > Date.now() + 90 * 86400000
      )
        return invalid(["Choose a visit in the next 90 days."]);
      if (l.seeker_visited || l.broker_visited)
        return NextResponse.json(
          { error: "A completed visit cannot be rescheduled." },
          { status: 409 },
        );
      patch.visit_at = new Date(at).toISOString();
      patch.visit = patch.visit_at;
      patch.status = "Visit Scheduled";
    } else if (b.action === "confirm") {
      if (!l.visit_at || Date.parse(l.visit_at) > Date.now())
        return NextResponse.json(
          { error: "Confirm after the scheduled visit time." },
          { status: 409 },
        );
      if (owner) patch.seeker_visited = true;
      if (broker || admin) patch.broker_visited = true;
      // Reviews require both parties to independently confirm the visit.
      if (
        (l.seeker_visited || patch.seeker_visited) &&
        (l.broker_visited || patch.broker_visited)
      )
        patch.status = "Visited";
    } else if (b.action === "status") {
      if (!broker && !admin)
        return NextResponse.json(
          { error: "Only the assigned broker can update the pipeline." },
          { status: 403 },
        );
      if (
        !(LEAD_STAGES as readonly string[]).includes(text(b.status)) ||
        ["Visited", "Visit Scheduled"].includes(text(b.status))
      )
        return invalid([
          "Choose a valid pipeline stage; visits use the visit controls.",
        ]);
      if (
        b.status === "Negotiating" &&
        (!l.seeker_visited || !l.broker_visited)
      )
        return invalid(["Confirm the visit before negotiating."]);
      patch.status = b.status;
    } else return invalid(["Choose schedule, confirm or status."]);
    let update = db.from("leads").update(patch).eq("id", id);
    if (b.action === "schedule")
      update = update.eq("seeker_visited", false).eq("broker_visited", false);
    if (b.action === "confirm") update = update.eq("visit_at", l.visit_at);
    const { data: changed, error: save } = await update.select("id");
    if (save) throw save;
    if (!changed.length)
      return NextResponse.json(
        { error: "Visit changed. Refresh and try again." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
