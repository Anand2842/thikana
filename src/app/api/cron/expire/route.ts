import { NextResponse } from "next/server";
import { listings as mockListings } from "@/lib/mock-data";
import { STALE_AFTER_HRS } from "@/lib/trust";
import { createServiceClient } from "@/lib/supabase/server";

// Cron: mark listings stale after STALE_AFTER_HRS without reconfirm.
// If CRON_SECRET is set, require `Authorization: Bearer <secret>`
// (Vercel Cron sends this header when the secret is configured).
// Without it (local dev), the route stays open.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sb = createServiceClient();
    const { data: stale, error: readErr } = await sb
      .from("listings")
      .select("id")
      .eq("verification", "verified")
      .gte("hrs", STALE_AFTER_HRS);
    if (readErr) throw readErr;
    const ids = (stale ?? []).map((r) => r.id as string);
    if (ids.length) {
      const { error: writeErr } = await sb.from("listings").update({ verification: "stale" }).in("id", ids);
      if (writeErr) throw writeErr;
    }
    return NextResponse.json({ expired: ids, count: ids.length, source: "supabase" });
  } catch {
    const expired = mockListings.filter((l) => l.hrs >= STALE_AFTER_HRS && l.verification === "verified");
    return NextResponse.json({
      expired: expired.map((l) => l.id),
      count: expired.length,
      source: "mock",
    });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
