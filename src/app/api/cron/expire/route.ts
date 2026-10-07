import { NextResponse } from "next/server";
import { unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data: stale, error: se } = await createServiceClient()
      .from("listings")
      .select("id,revision")
      .eq("verification", "verified")
      .lte("last_confirmed_at", new Date(Date.now() - 604800000).toISOString());
    if (se) throw se;
    const ids = (stale ?? []).map((l) => l.id as string);
    // Per-row revision bumps keep monotonicity for bulk conflict detection.
    for (const l of (stale ?? []) as { id: string; revision: number }[]) {
      const { error } = await createServiceClient()
        .from("listings")
        .update({ verification: "stale", revision: (l.revision ?? 1) + 1 })
        .eq("id", l.id);
      if (error) throw error;
    }
    return NextResponse.json({
      expired: ids,
      count: ids.length,
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function GET(req: Request) {
  return POST(req);
}
