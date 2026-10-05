import { NextResponse } from "next/server";
import { unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data, error } = await createServiceClient()
      .from("listings")
      .update({ verification: "stale" })
      .eq("verification", "verified")
      .lte("last_confirmed_at", new Date(Date.now() - 604800000).toISOString())
      .select("id");
    if (error) throw error;
    return NextResponse.json({
      expired: data.map((l) => l.id),
      count: data.length,
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function GET(req: Request) {
  return POST(req);
}
