import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { runIdempotentBatch } from "@/lib/idempotent-batch";
import { checkRateLimit } from "@/lib/ratelimit";

const MAX_ACTIONS = 20;
const ACTIONS = ["taken", "onhold", "available", "reconfirm"] as const;

// Apply one explicit availability action to up to 20 own listings with
// per-item results. Every item runs inside the guarded
// apply_availability_action transaction (ownership, revision, live broker
// approval and review eligibility rechecked together), so a concurrent
// suspension or moderation decision becomes a visible rejection, never a
// silent overwrite. Retries resume unfinished items via the receipt.
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
    key: `inventory-actions:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  const requestId =
    typeof b.requestId === "string" && b.requestId.length >= 1 && b.requestId.length <= 100
      ? b.requestId
      : "";
  const action = typeof b.action === "string" ? b.action : "";
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!requestId) return invalid(["Send a stable request ID for this batch."]);
  if (!(ACTIONS as readonly string[]).includes(action))
    return invalid(["Choose Taken, On Hold, Available or Reconfirm."]);
  if (!rawItems.length || rawItems.length > MAX_ACTIONS)
    return invalid([`Send 1–${MAX_ACTIONS} listings per batch.`]);
  const items = rawItems.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    return {
      id: typeof o.listingId === "string" ? o.listingId : "",
      expectedRevision:
        typeof o.expectedRevision === "number" ? o.expectedRevision : -1,
    };
  });
  if (items.some((it) => !it.id || it.expectedRevision < 0))
    return invalid(["Each item needs a listing ID and its expected revision."]);
  try {
    const db = createServiceClient();
    return await runIdempotentBatch({
      db,
      brokerId,
      requestId,
      kind: "bulk-action",
      maxItems: MAX_ACTIONS,
      items,
      process: async (it) => {
        const { data, error } = await db.rpc("apply_availability_action", {
          p_listing_id: it.id,
          p_broker_id: brokerId,
          p_expected_revision: it.expectedRevision,
          p_action: action,
        });
        if (error) {
          const msg = (error as { message?: string }).message ?? "";
          if (msg.includes("Stale revision"))
            return { id: it.id, listingId: it.id, ok: false as const, error: "Listing changed. Refresh and try again." };
          if (msg.includes("Listing not found"))
            return { id: it.id, listingId: it.id, ok: false as const, error: "Listing not found." };
          if (msg.includes("Broker approval"))
            return { id: it.id, listingId: it.id, ok: false as const, error: "Your broker approval is required." };
          if (msg.includes("Under review") || msg.includes("reconfirmed"))
            return { id: it.id, listingId: it.id, ok: false as const, error: msg };
          if (msg.includes("Invalid action"))
            return { id: it.id, listingId: it.id, ok: false as const, error: "Choose Taken, On Hold, Available or Reconfirm." };
          throw error;
        }
        const saved = data as {
          revision: number;
          availability_status: string;
          verification: string;
        };
        return {
          id: it.id,
          listingId: it.id,
          ok: true as const,
          revision: saved.revision,
          availabilityStatus: saved.availability_status,
          verification: saved.verification,
        };
      },
    });
  } catch (e) {
    return unavailable(e);
  }
}
