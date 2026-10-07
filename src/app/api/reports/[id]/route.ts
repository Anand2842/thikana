import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize("admin");
  if (response) return response;
  const { id } = await ctx.params,
    b = await body(req);
  try {
    const db = createServiceClient();
    const { data: report, error: e } = await db
      .from("reports")
      .select("id,target_type,listing_id,broker_id,status")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!report)
      return NextResponse.json(
        { error: "Report not found." },
        { status: 404 },
      );
    // Investigation progress: Open → Investigating → Resolved (via uphold/dismiss).
    // Guarded AND executed atomically inside resolve_report: a stale request
    // fails there instead of reopening resolved history.
    if (text(b.status) === "Investigating") {
      const { error: se } = await db.rpc("resolve_report", {
        target: id,
        upheld: null,
        actor_id: user!.id,
        detail: `Report ${id} under investigation.`,
        actor_email: user!.email ?? "",
        to_status: "Investigating",
      });
      if (se) {
        if (se.message?.includes("Only an open report"))
          return NextResponse.json({ error: se.message }, { status: 409 });
        throw se;
      }
      return NextResponse.json({ ok: true });
    }
    // Plain investigation note (no state change).
    if (typeof b.uphold !== "boolean" && text(b.status) !== "Investigating") {
      if (text(b.body).length < 2 || text(b.body).length > 2000)
        return invalid(["Note must be 2–2,000 characters."]);
      const { error: ne } = await db.from("report_notes").insert({
        id: `RN-${crypto.randomUUID()}`,
        report_id: id,
        author_id: user!.id,
        body: text(b.body),
      });
      if (ne) throw ne;
      return NextResponse.json({ ok: true });
    }
    if (report.status.startsWith("Resolved"))
      return NextResponse.json(
        { error: "Report already resolved." },
        { status: 409 },
      );
    // Single atomic transaction per decision: state change + audit log live
    // or die together inside resolve_report. No separate writes here.
    const { error } = await db.rpc("resolve_report", {
      target: id,
      upheld: b.uphold,
      actor_id: user!.id,
      detail: `Report ${id} ${b.uphold ? "upheld" : "dismissed"}. ${text(b.reason).slice(0, 500)}`,
      actor_email: user!.email ?? "",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
