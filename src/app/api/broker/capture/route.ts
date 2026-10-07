import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import {
  MAX_CAPTURE_CHARS,
  MAX_CAPTURE_SCREENSHOTS,
  MAX_EXTRACT_PER_DAY,
} from "@/lib/extraction";
import { checkRateLimit } from "@/lib/ratelimit";

// Create an extraction request from broker-selected text or screenshots.
// Nothing is sent anywhere yet: this only validates bounds, reserves quota
// and returns a durable receipt the extract call (and a page refresh)
// recovers from.
export async function POST(req: Request) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `capture:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  const clientRequestId =
    typeof b.clientRequestId === "string" &&
    b.clientRequestId.length >= 1 &&
    b.clientRequestId.length <= 100
      ? b.clientRequestId
      : "";
  const text = typeof b.text === "string" ? b.text.slice(0, MAX_CAPTURE_CHARS + 1) : "";
  const screenshotIds = Array.isArray(b.screenshotIds)
    ? (b.screenshotIds as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  if (!clientRequestId) return invalid(["Send a stable request ID."]);
  const hasText = text.trim().length > 0;
  const hasShots = screenshotIds.length > 0;
  if (hasText === hasShots)
    return invalid(["Send pasted text or up to three screenshots — not both, not neither."]);
  if (text.length > MAX_CAPTURE_CHARS)
    return invalid([`Paste at most ${MAX_CAPTURE_CHARS} characters.`]);
  if (screenshotIds.length > MAX_CAPTURE_SCREENSHOTS)
    return invalid([`Select at most ${MAX_CAPTURE_SCREENSHOTS} screenshots.`]);
  try {
    const db = createServiceClient();
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified")
      .eq("id", brokerId)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        { error: "Draft workspace unlocks after approval." },
        { status: 403 },
      );
    let shots: string[] = [];
    if (hasShots) {
      const { data: assets, error: ae } = await db
        .from("inventory_assets")
        .select("id")
        .in("id", [...new Set(screenshotIds)])
        .eq("broker_id", brokerId)
        .eq("kind", "screenshot")
        .eq("state", "ready");
      if (ae) throw ae;
      shots = ((assets ?? []) as { id: string }[]).map((a) => a.id);
      if (shots.length !== new Set(screenshotIds).size)
        return NextResponse.json(
          { error: "Screenshots must be your own verified uploads." },
          { status: 404 },
        );
      shots.sort();
    }
    const inputHash = createHash("sha256")
      .update(JSON.stringify(hasText ? { text: text.trim() } : { shots }))
      .digest("hex");
    const { data: prior, error: pe } = await db
      .from("inventory_requests")
      .select("id,input_hash,results,state")
      .eq("broker_id", brokerId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (pe) throw pe;
    if (prior) {
      const p = prior as { id: string; input_hash: string; results: unknown; state: string };
      if (p.input_hash !== inputHash)
        return NextResponse.json(
          { error: "Request ID already used with different input. Use a new request ID." },
          { status: 409 },
        );
      return NextResponse.json({
        request: { id: p.id, state: p.state, results: p.results },
        replay: true,
      });
    }
    // One active extraction per broker; pilot daily budget.
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recent, error: re } = await db
      .from("inventory_requests")
      .select("id,state,lease_until")
      .eq("broker_id", brokerId)
      .eq("kind", "extract")
      .gte("created_at", dayAgo);
    if (re) throw re;
    const rows = (recent ?? []) as { id: string; state: string; lease_until: string | null }[];
    if (rows.length >= MAX_EXTRACT_PER_DAY)
      return NextResponse.json(
        { error: "Daily extraction limit reached. Add homes manually." },
        { status: 429 },
      );
    if (
      rows.some(
        (r) =>
          r.state !== "done" &&
          r.lease_until !== null &&
          new Date(r.lease_until).getTime() > Date.now(),
      )
    )
      return NextResponse.json(
        { error: "An extraction is already running. Finish it first." },
        { status: 409 },
      );
    const rowId = `Q-${crypto.randomUUID()}`;
    const { error: ie } = await db.from("inventory_requests").insert({
      id: rowId,
      broker_id: brokerId,
      client_request_id: clientRequestId,
      kind: "extract",
      input_hash: inputHash,
      items: hasText ? { text: text.trim() } : { screenshots: shots },
      state: "open",
    });
    if (ie) {
      if (ie.code === "23505")
        return NextResponse.json(
          { error: "Request ID already used. Use a new request ID." },
          { status: 409 },
        );
      throw ie;
    }
    return NextResponse.json(
      { request: { id: rowId, state: "open", results: [] }, replay: false },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
