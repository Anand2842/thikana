import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { submitOneDraft } from "@/lib/listing-submit";
import { checkRateLimit } from "@/lib/ratelimit";

const MAX_BATCH = 10;

// Submit up to 10 drafts in one request with per-item results. Idempotent:
// the client sends a stable request ID; replaying it for the same draft set
// resumes unfinished items and replays recorded ones, while the same ID
// with a different draft set is rejected. A crashed batch resumes safely — already-submitted drafts replay
// their existing listing through the atomic per-draft path, so repeated or
// concurrent submissions can never create two listings.
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
    limit: 5,
    windowMs: 60000,
    key: `draft-batch:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  const requestId =
    typeof b.requestId === "string" && b.requestId.length >= 1 && b.requestId.length <= 100
      ? b.requestId
      : "";
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!requestId) return invalid(["Send a stable request ID for this batch."]);
  if (!rawItems.length || rawItems.length > MAX_BATCH)
    return invalid([`Send 1–${MAX_BATCH} drafts per batch.`]);
  const items = rawItems.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    return {
      draftId: typeof o.draftId === "string" ? o.draftId : "",
      expectedRevision:
        typeof o.expectedRevision === "number" ? o.expectedRevision : -1,
    };
  });
  if (items.some((it) => !it.draftId || it.expectedRevision < 0))
    return invalid(["Each item needs a draft ID and its expected revision."]);
  const sorted = [...items].sort((a, c) =>
    a.draftId < c.draftId ? -1 : a.draftId > c.draftId ? 1 : 0,
  );
  // Identity is the draft SET, not revisions: fixing a failed draft bumps
  // its revision, and that fixed revision is exactly what a resume must
  // send. A different draft set under the same ID is rejected. Per-item
  // staleness is still enforced by the atomic path at processing time.
  const inputHash = createHash("sha256")
    .update(JSON.stringify(sorted.map((it) => it.draftId)))
    .digest("hex");
  try {
    const db = createServiceClient();
    const { data: prior, error: pe } = await db
      .from("inventory_requests")
      .select("id,input_hash,results,state")
      .eq("broker_id", brokerId)
      .eq("client_request_id", requestId)
      .maybeSingle();
    if (pe) throw pe;
    // Crash recovery: an interrupted batch left state open with partial
    // results. Replaying the same request resumes only the unfinished
    // items; finished ones replay their recorded listing — never resubmit.
    const resume = async (rowId: string, recorded: unknown) => {
      const done = new Map(
        (
          (Array.isArray(recorded) ? recorded : []) as {
            draftId?: string;
            ok?: boolean;
          }[]
        )
          .filter((r) => r.ok === true && typeof r.draftId === "string")
          .map((r) => [r.draftId as string, r]),
      );
      const results = [];
      for (const it of items) {
        const prev = done.get(it.draftId);
        if (prev) {
          results.push(prev);
          continue;
        }
        try {
          const r = await submitOneDraft(
            db,
            brokerId,
            it.draftId,
            it.expectedRevision,
            rowId,
          );
          results.push(
            r.ok
              ? {
                  draftId: it.draftId,
                  ok: true as const,
                  listingId: r.listing.id,
                  propId: r.listing.propId,
                  duplicate: r.duplicate,
                }
              : { draftId: it.draftId, ok: false as const, error: r.error },
          );
        } catch {
          results.push({
            draftId: it.draftId,
            ok: false as const,
            error: "Could not save changes. Please try again.",
          });
        }
      }
      const complete = results.every((r) => r.ok);
      await db
        .from("inventory_requests")
        .update({
          results,
          state: complete ? "done" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      return NextResponse.json({ results, replay: done.size > 0, complete });
    };
    if (prior) {
      const p = prior as {
        id: string;
        input_hash: string;
        results: unknown;
        state: string;
      };
      if (p.input_hash !== inputHash)
        return NextResponse.json(
          { error: "Request ID already used with different drafts. Use a new request ID." },
          { status: 409 },
        );
      if (p.state === "done")
        return NextResponse.json({
          results: p.results,
          replay: true,
          complete: true,
        });
      return resume(p.id, p.results);
    }
    const rowId = `Q-${crypto.randomUUID()}`;
    const { error: ie } = await db.from("inventory_requests").insert({
      id: rowId,
      broker_id: brokerId,
      client_request_id: requestId,
      kind: "batch-submit",
      input_hash: inputHash,
      items: sorted,
      state: "open",
    });
    if (ie) {
      // A concurrent identical batch won the insert: replay its receipt.
      if (ie.code === "23505") {
        const { data: winner } = await db
          .from("inventory_requests")
          .select("id,input_hash,results,state")
          .eq("broker_id", brokerId)
          .eq("client_request_id", requestId)
          .maybeSingle();
        const w = winner as {
          id: string;
          input_hash: string;
          results: unknown;
          state: string;
        } | null;
        if (w && w.input_hash === inputHash) {
          if (w.state === "done")
            return NextResponse.json({
              results: w.results,
              replay: true,
              complete: true,
            });
          return resume(w.id, w.results);
        }
        return NextResponse.json(
          { error: "Request ID already used with different drafts. Use a new request ID." },
          { status: 409 },
        );
      }
      throw ie;
    }
    return resume(rowId, []);
  } catch (e) {
    return unavailable(e);
  }
}
