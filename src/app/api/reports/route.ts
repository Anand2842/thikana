import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateReport, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `reports:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateReport(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const targetType = text(b.targetType) || "listing";
    let listingId: string | null = null,
      brokerId: string | null = null;
    if (targetType === "broker") {
      const { data: br, error: be } = await db
        .from("brokers")
        .select("id")
        .eq("id", text(b.brokerId))
        .maybeSingle();
      if (be) throw be;
      if (!br)
        return NextResponse.json(
          { error: "Broker not found." },
          { status: 404 },
        );
      brokerId = br.id;
    } else {
      const { data: l, error: e } = await db
        .from("listings")
        .select("id")
        .eq("id", text(b.listingId))
        .maybeSingle();
      if (e) throw e;
      if (!l)
        return NextResponse.json(
          { error: "Listing not found." },
          { status: 404 },
        );
      listingId = l.id;
    }
    const { data, error } = await db
      .from("reports")
      .insert({
        id: `R-${crypto.randomUUID()}`,
        target_type: targetType,
        listing_id: listingId,
        broker_id: brokerId,
        reason: text(b.reason),
        details: text(b.details),
        reporter: user!.email,
        owner_id: user!.id,
        // DD Mon YYYY ("6 Oct 2026") — the format report auto-escalation parses for its 30-day window.
        date: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
