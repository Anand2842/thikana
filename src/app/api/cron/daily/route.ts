import { NextResponse } from "next/server";
import { POST as expireCron } from "../expire/route";
import { POST as remindersCron } from "../reminders/route";
import { POST as retentionCron } from "../retention/route";
import { unavailable } from "@/lib/api";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run all cron jobs.
    // Since they only check headers and don't consume the request body, we can pass the same req object.
    const [expireRes, remindersRes, retentionRes] = await Promise.all([
      expireCron(req),
      remindersCron(req),
      retentionCron(req)
    ]);

    // Parse the results if we want to return a combined summary
    const [expireData, remindersData, retentionData] = await Promise.all([
      expireRes.json().catch(() => ({})),
      remindersRes.json().catch(() => ({})),
      retentionRes.json().catch(() => ({}))
    ]);

    return NextResponse.json({
      expire: expireData,
      reminders: remindersData,
      retention: retentionData
    });
  } catch (e) {
    return unavailable(e);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
