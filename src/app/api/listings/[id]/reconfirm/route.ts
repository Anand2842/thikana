import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { checkRateLimit } from "@/lib/ratelimit";

// Reconfirm one listing through the same guarded operation as bulk
// availability actions: ownership, revision, live broker approval and
// review eligibility are rechecked inside one transaction, so a concurrent
// suspension or moderation decision cannot be overwritten.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `reconfirm:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params;
  const b = await body(req).catch(() => ({} as Record<string, unknown>));
  try {
    const db = createServiceClient();
    // The editor may send the revision it loaded; otherwise resolve the
    // current one. Either way the RPC rechecks everything atomically.
    let expectedRevision =
      typeof b.expectedRevision === "number" ? b.expectedRevision : null;
    if (expectedRevision === null) {
      const { data: current, error: ce } = await db
        .from("listings")
        .select("revision")
        .eq("id", id)
        .maybeSingle();
      if (ce) throw ce;
      if (!current)
        return NextResponse.json(
          { error: "Listing not found." },
          { status: 404 },
        );
      expectedRevision = (current as { revision: number }).revision ?? 1;
    }
    const { error } = await db.rpc("apply_availability_action", {
      p_listing_id: id,
      p_broker_id: brokerId,
      p_expected_revision: expectedRevision,
      p_action: "reconfirm",
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (
        msg.includes("Stale revision") ||
        msg.includes("Under review") ||
        msg.includes("reconfirmed") ||
        msg.includes("Broker approval")
      )
        return NextResponse.json({ error: msg }, { status: 409 });
      if (msg.includes("Listing not found"))
        return NextResponse.json({ error: msg }, { status: 404 });
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}

export async function GET() {
  return invalid(["Use POST to reconfirm."]);
}
