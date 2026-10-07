import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
// Liveness probe for uptime monitoring. Returns dependency status without
// exposing secrets or row contents. Backup verification itself is an ops
// runbook item (Supabase PITR + restore drill), not an app endpoint.
export async function GET() {
  const checks: Record<string, boolean> = {
    env: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
  };
  try {
    const { error } = await createServiceClient()
      .from("brokers")
      .select("id", { count: "exact", head: true });
    checks.database = !error;
  } catch {
    checks.database = false;
  }
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
