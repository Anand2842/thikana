import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { submitOneDraft } from "@/lib/listing-submit";
import { runIdempotentBatch } from "@/lib/idempotent-batch";
import { checkRateLimit } from "@/lib/ratelimit";

const MAX_BATCH = 10;

// Submit up to 10 drafts in one request with per-item results. Idempotent:
// the client sends a stable request ID; replaying it for the same draft set
// resumes unfinished items and replays recorded ones, while the same ID
// with a different draft set is rejected. A crashed batch resumes safely —
// already-submitted drafts replay their existing listing through the atomic
// per-draft path, so repeated or concurrent submissions can never create
// two listings.
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
      id: typeof o.draftId === "string" ? o.draftId : "",
      expectedRevision:
        typeof o.expectedRevision === "number" ? o.expectedRevision : -1,
    };
  });
  if (items.some((it) => !it.id || it.expectedRevision < 0))
    return invalid(["Each item needs a draft ID and its expected revision."]);
  try {
    const db = createServiceClient();
    return await runIdempotentBatch({
      db,
      brokerId,
      requestId,
      kind: "batch-submit",
      maxItems: MAX_BATCH,
      items,
      process: async (it, rowId) => {
        const r = await submitOneDraft(
          db,
          brokerId,
          it.id,
          it.expectedRevision,
          rowId,
        );
        if (r.ok)
          return {
            id: it.id,
            draftId: it.id,
            ok: true,
            listingId: r.listing.id,
            propId: r.listing.propId,
            duplicate: r.duplicate,
          };
        return { id: it.id, draftId: it.id, ok: false, error: r.error };
      },
    });
  } catch (e) {
    return unavailable(e);
  }
}
