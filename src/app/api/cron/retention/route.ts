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
    // Unfinished media uploads (reserved, never completed) expire after 24
    // hours: delete the ledger row and the stored bytes together. Ready
    // assets follow draft/listing retention via their parent references.
    const { data: staleAssets, error: ae } = await db
      .from("inventory_assets")
      .select("id,storage_path")
      .eq("state", "reserved")
      .lt("reserved_until", new Date().toISOString());
    if (ae) throw ae;
    const stale = (staleAssets ?? []) as { id: string; storage_path: string }[];
    let assetsCleared = 0;
    if (stale.length) {
      const { error: adel } = await db
        .from("inventory_assets")
        .delete()
        .in(
          "id",
          stale.map((a) => a.id),
        );
      if (adel) throw adel;
      assetsCleared = stale.length;
      const { error: robj } = await db.storage
        .from("inventory-media")
        .remove(stale.map((a) => a.storage_path));
      if (robj) throw robj;
    }
    // Source screenshots expire after seven days — they are extraction
    // inputs, never listing photos, so no listing can reference them.
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: oldShots, error: se } = await db
      .from("inventory_assets")
      .select("id,storage_path")
      .eq("kind", "screenshot")
      .lt("created_at", weekAgo);
    if (se) throw se;
    const shots = (oldShots ?? []) as { id: string; storage_path: string }[];
    let screenshotsCleared = 0;
    if (shots.length) {
      const { error: sdel } = await db
        .from("inventory_assets")
        .delete()
        .in(
          "id",
          shots.map((a) => a.id),
        );
      if (sdel) throw sdel;
      screenshotsCleared = shots.length;
      const { error: robj } = await db.storage
        .from("inventory-media")
        .remove(shots.map((a) => a.storage_path));
      if (robj) throw robj;
    }
    // Redact raw extraction inputs after seven days; result receipts
    // (created draft IDs) stay for accountability.
    const { data: redacted, error: red } = await db
      .from("inventory_requests")
      .update({ items: { redacted: true }, updated_at: new Date().toISOString() })
      .eq("kind", "extract")
      .eq("state", "done")
      .lt("updated_at", weekAgo)
      .select("id");
    if (red) throw red;
    return NextResponse.json({
      anonymized: oldIds,
      count: oldIds.length,
      messagesCleared,
      cityRequests: (oldReqs ?? []).length,
      uploadsCleared: assetsCleared,
      screenshotsCleared,
      inputsRedacted: (redacted ?? []).length,
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function GET(req: Request) {
  return POST(req);
}
