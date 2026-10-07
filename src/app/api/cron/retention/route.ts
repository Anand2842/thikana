import { NextResponse } from "next/server";
import { unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
// Data retention: anonymize enquiry PII older than 3 calendar years (dispute
// window), delete their message bodies, and anonymize old city-request
// contact details. Moderation records (reports, decisions) are kept for audit.
// Calendar math (setFullYear), not fixed 1095 days, so leap years don't shift
// the boundary early. Wire to a weekly cron in vercel.json.
function threeYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString();
}
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const cutoff = threeYearsAgo();
    const db = createServiceClient();
    // All old leads, redacted or not: messages must not survive a later pass
    // just because the parent was already anonymized.
    const { data: oldLeads, error: lq } = await db
      .from("leads")
      .select("id")
      .lt("created_at", cutoff);
    if (lq) throw lq;
    const oldIds = (oldLeads ?? []).map((l) => l.id);
    let messagesCleared = 0;
    if (oldIds.length) {
      const { data: cleared, error: me } = await db
        .from("lead_messages")
        .delete()
        .in("lead_id", oldIds)
        .select("id");
      if (me) throw me;
      messagesCleared = (cleared ?? []).length;
      const { error: ue } = await db
        .from("leads")
        .update({
          user_name: "[redacted]",
          phone: "[redacted]",
          msg: "[redacted]",
          req: "",
          time: "",
        })
        .in("id", oldIds)
        .not("user_name", "eq", "[redacted]");
      if (ue) throw ue;
    }
    const { data: oldReqs, error: ce } = await db
      .from("city_requests")
      .update({ name: "[redacted]", phone: "[redacted]" })
      .lt("created_at", cutoff)
      .not("name", "eq", "[redacted]")
      .select("id");
    if (ce && ce.code !== "42703") throw ce;
    return NextResponse.json({
      anonymized: oldIds,
      count: oldIds.length,
      messagesCleared,
      cityRequests: (oldReqs ?? []).length,
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function GET(req: Request) {
  return POST(req);
}
