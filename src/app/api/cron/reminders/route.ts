import { NextResponse } from "next/server";
import { unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
// Flags visits due in the next 24h so dashboards can surface them as
// reminders. Email/SMS delivery is an ops integration (see deploy notes);
// until then the flag drives the in-app "Upcoming visits" sections.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const now = new Date().toISOString(),
      soon = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const db = createServiceClient();
    const { data, error } = await db
      .from("leads")
      .update({ visit_reminded_at: now })
      .gte("visit_at", now)
      .lte("visit_at", soon)
      .eq("seeker_visited", false)
      .eq("broker_visited", false)
      .is("visit_reminded_at", null)
      .select("id");
    if (error) throw error;
    return NextResponse.json({
      reminded: data.map((l) => l.id),
      count: data.length,
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function GET(req: Request) {
  return POST(req);
}
