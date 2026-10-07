import { NextResponse } from "next/server";
import { authorize, body, invalid, requireAal2, unavailable } from "@/lib/api";
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
    // Admin override powers (accept on behalf, broker-side confirm, cancel
    // bypass, pipeline control) require a TOTP-verified session.
    if (admin) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    const patch: Record<string, unknown> = {};
    if (b.action === "schedule") {
      // Proposal semantics: either participant may propose a time, and
      // calling "schedule" again with a new time overwrites the previous
      // proposal and resets visit_accepted to false (re-proposing). There is
      // deliberately no separate "propose" action — schedule IS propose.
      // The other side must accept before the visit counts as agreed.
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
      if (l.status === "Closed")
        return NextResponse.json(
          { error: "Reopen the enquiry before scheduling a visit." },
          { status: 409 },
        );
      patch.visit_at = new Date(at).toISOString();
      patch.visit = patch.visit_at;
      patch.visit_proposed_by = user!.id;
      patch.visit_accepted = false;
      patch.seeker_visited = false;
      patch.broker_visited = false;
      patch.status = "Visit Scheduled";
    } else if (b.action === "accept") {
      // Accept a proposed visit. Only the participant who did NOT propose
      // may accept (admins may accept on either side's behalf). Legacy rows
      // with no recorded proposer may be accepted by either participant.
      if (!l.visit_at)
        return NextResponse.json(
          { error: "No proposed visit to accept." },
          { status: 409 },
        );
      if (l.visit_accepted)
        return NextResponse.json(
          { error: "Visit already accepted." },
          { status: 409 },
        );
      if (!admin && l.visit_proposed_by === user!.id)
        return NextResponse.json(
          { error: "Wait for the other side to accept." },
          { status: 409 },
        );
      patch.visit_accepted = true;
    } else if (b.action === "confirm") {
      if (!l.visit_at || Date.parse(l.visit_at) > Date.now())
        return NextResponse.json(
          { error: "Confirm after the scheduled visit time." },
          { status: 409 },
        );
      // A recorded proposal must be accepted before anyone confirms it.
      // Legacy rows without a recorded proposer keep the old behavior.
      if (l.visit_proposed_by && !l.visit_accepted)
        return NextResponse.json(
          { error: "Accept the proposed visit first." },
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
    } else if (b.action === "cancel") {
      // A completed confirmation is history, not scratch state: cancellation
      // is allowed until either side confirms. Admins can still intervene
      // (support override), which is logged by actor in messages.
      if (!l.visit_at || ((l.seeker_visited || l.broker_visited) && !admin))
        return NextResponse.json(
          { error: "Only a scheduled, unvisited visit can be cancelled." },
          { status: 409 },
        );
      patch.visit_at = null;
      patch.visit = "—";
      patch.seeker_visited = false;
      patch.broker_visited = false;
      patch.visit_proposed_by = null;
      patch.visit_accepted = false;
      patch.status = "Contacted";
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
      if (text(b.status) === "Closed") {
        const o = text(b.outcome);
        if (o !== "booked" && o !== "not_interested")
          return NextResponse.json(
            { error: "Choose booked or not interested when closing." },
            { status: 400 },
          );
        patch.outcome = o;
      } else {
        patch.outcome = null;
      }
      // Broker pipeline activity also starts the response clock (once).
      if (broker && !l.first_response_at)
        patch.first_response_at = new Date().toISOString();
      patch.status = b.status;
    } else return invalid(["Choose schedule, accept, confirm, cancel or status."]);
    let update = db.from("leads").update(patch).eq("id", id);
    if (b.action === "schedule")
      update = update.eq("seeker_visited", false).eq("broker_visited", false);
    if (b.action === "accept")
      update = update
        .eq("visit_at", l.visit_at)
        .eq("visit_accepted", false)
        // Pin the proposal identity, not just its timestamp: a replacement
        // proposal (same time, new proposer) must invalidate this accept.
        // .eq(col, null) matches IS NULL, so legacy rows pin correctly too.
        .eq("visit_proposed_by", l.visit_proposed_by);
    if (b.action === "confirm") {
      // Pin the other side's flag to what we read: a concurrent confirm on
      // the other side loses with 409 instead of producing a wrong status.
      update = update.eq("visit_at", l.visit_at);
      if (patch.seeker_visited) update = update.eq("broker_visited", !!l.broker_visited);
      if (patch.broker_visited) update = update.eq("seeker_visited", !!l.seeker_visited);
    }
    if (b.action === "cancel")
      // Pin timestamp AND both flags to what we read: a confirmation that
      // commits while this cancel waits on the row lock fails the write
      // (409) instead of being silently erased.
      update = update
        .eq("visit_at", l.visit_at)
        .eq("seeker_visited", !!l.seeker_visited)
        .eq("broker_visited", !!l.broker_visited);
    const { data: changed, error: save } = await update.select(
      "id,status,seeker_visited,broker_visited",
    );
    if (save) throw save;
    if (!changed.length)
      return NextResponse.json(
        { error: "Visit changed. Refresh and try again." },
        { status: 409 },
      );
    // RETURNING reflects BEFORE-trigger row effects (e.g. auto-Visited),
    // so callers show the converged status, not a stale optimistic one.
    return NextResponse.json({ ok: true, lead: changed[0] });
  } catch (e) {
    return unavailable(e);
  }
}
