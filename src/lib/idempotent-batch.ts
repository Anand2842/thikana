import "server-only";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "./supabase/server";

// Shared idempotent batch runner for inventory write batches (submission,
// availability actions, later extraction). One receipt row per client
// request ID: replays resume unfinished items and return recorded ones;
// the same ID with a different item set is rejected; a concurrent identical
// insert loses to the winner and replays it.
export interface BatchItem {
  id: string;
  expectedRevision: number;
}

export interface BatchItemResult {
  id: string;
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function runIdempotentBatch(opts: {
  db: ReturnType<typeof createServiceClient>;
  brokerId: string;
  requestId: string;
  kind: string;
  maxItems: number;
  items: BatchItem[];
  process: (item: BatchItem, rowId: string) => Promise<BatchItemResult>;
}): Promise<NextResponse> {
  const { db, brokerId, requestId, kind, maxItems, items, process } = opts;
  const sorted = [...items].sort((a, c) =>
    a.id < c.id ? -1 : a.id > c.id ? 1 : 0,
  );
  // Identity is the item SET, not revisions: fixing a failed item bumps its
  // revision, and that fixed revision is exactly what a resume must send.
  const inputHash = createHash("sha256")
    .update(JSON.stringify(sorted.map((it) => it.id)))
    .digest("hex");
  const resume = async (rowId: string, recorded: unknown) => {
    const done = new Map(
      (
        (Array.isArray(recorded) ? recorded : []) as {
          id?: string;
          ok?: boolean;
        }[]
      )
        .filter((r) => r.ok === true && typeof r.id === "string")
        .map((r) => [r.id as string, r]),
    );
    const results: BatchItemResult[] = [];
    for (const it of items) {
      const prev = done.get(it.id) as BatchItemResult | undefined;
      if (prev) {
        results.push(prev);
        continue;
      }
      try {
        results.push(await process(it, rowId));
      } catch {
        results.push({
          id: it.id,
          ok: false,
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
  const { data: prior, error: pe } = await db
    .from("inventory_requests")
    .select("id,input_hash,results,state")
    .eq("broker_id", brokerId)
    .eq("client_request_id", requestId)
    .maybeSingle();
  if (pe) throw pe;
  if (prior) {
    const p = prior as {
      id: string;
      input_hash: string;
      results: unknown;
      state: string;
    };
    if (p.input_hash !== inputHash)
      return NextResponse.json(
        {
          error:
            "Request ID already used with different items. Use a new request ID.",
        },
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
  if (items.length > maxItems)
    return NextResponse.json(
      { error: `Send 1–${maxItems} items per batch.` },
      { status: 400 },
    );
  const rowId = `Q-${crypto.randomUUID()}`;
  const { error: ie } = await db.from("inventory_requests").insert({
    id: rowId,
    broker_id: brokerId,
    client_request_id: requestId,
    kind,
    input_hash: inputHash,
    items: sorted,
    state: "open",
  });
  if (ie) {
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
        {
          error:
            "Request ID already used with different items. Use a new request ID.",
        },
        { status: 409 },
      );
    }
    throw ie;
  }
  return resume(rowId, []);
}
