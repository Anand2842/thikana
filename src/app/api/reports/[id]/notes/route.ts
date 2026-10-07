import { NextResponse } from "next/server";
import { authorize, body, invalid, requireAal2, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchReportNotes, mapReportNote } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";
async function reportFor(
  db: ReturnType<typeof createServiceClient>,
  id: string,
) {
  const { data, error } = await db
    .from("reports")
    .select("id,owner_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const r = await reportFor(db, id);
    if (!r)
      return NextResponse.json(
        { error: "Report not found." },
        { status: 404 },
      );
    // Investigators see everything; reporters see their own thread.
    // Admin reads need a TOTP-verified session.
    if (userRole(user) !== "admin" && r.owner_id !== user!.id)
      return NextResponse.json(
        { error: "This report is not yours." },
        { status: 403 },
      );
    if (userRole(user) === "admin" && r.owner_id !== user!.id) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    return NextResponse.json({ notes: await fetchReportNotes([id]) });
  } catch (e) {
    return unavailable(e);
  }
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `report-notes:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params,
    b = await body(req);
  if (text(b.body).length < 2 || text(b.body).length > 2000)
    return invalid(["Note must be 2–2,000 characters."]);
  try {
    const db = createServiceClient();
    const r = await reportFor(db, id);
    if (!r)
      return NextResponse.json(
        { error: "Report not found." },
        { status: 404 },
      );
    // Investigators plus the reporter (evidence replies) may write.
    // Admin writes to reports they didn't file need a TOTP-verified session.
    if (userRole(user) !== "admin" && r.owner_id !== user!.id)
      return NextResponse.json(
        { error: "Only the investigation team or the reporter can reply." },
        { status: 403 },
      );
    if (userRole(user) === "admin" && r.owner_id !== user!.id) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    const { data, error } = await db
      .from("report_notes")
      .insert({
        id: `RN-${crypto.randomUUID()}`,
        report_id: id,
        author_id: user!.id,
        body: text(b.body),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(
      { note: mapReportNote(data) },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
