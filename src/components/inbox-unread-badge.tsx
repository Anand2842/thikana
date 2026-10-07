"use client";
import { useEffect, useState } from "react";
import { LEAD_READ_EVENT } from "@/components/lead-messages";

// Poll cadence for inbox badges.
const POLL_MS = 30_000;

// Design (read before "optimising" this):
// - Unread counts come from the server (GET thread returns `unread`
//   computed against this user's read watermark in lead_reads). No
//   client-side watermark inference, so arrivals before the first poll and
//   post-read polls are exact — a read event triggers an immediate refetch
//   rather than an optimistic zero.
// - Per-lead polling is O(rows) requests per 30s: fine at inbox scale
//   (tens of rows). Past ~100 rows, add a batched GET /api/leads/unread
//   and turn this into a purely presentational {leadId, count} pill.
// - Counts all new thread activity, including own messages sent from
//   another tab — acceptable for an activity nudge.
async function fetchUnread(leadId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/leads/${leadId}/messages`, {
      method: "GET",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (typeof data.unread === "number") return data.unread;
    // Fallback for older responses: derive from thread length is impossible
    // without a watermark, so keep the previous count instead of guessing.
    return null;
  } catch {
    return null;
  }
}

export default function InboxUnreadBadge({
  leadId,
  initialCount,
}: {
  leadId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [prevInitial, setPrevInitial] = useState(initialCount);
  // Adopt recalculated SSR counts when the parent refreshes its data.
  // Adjusted during render (not in an effect) per React docs.
  if (prevInitial !== initialCount) {
    setPrevInitial(initialCount);
    setCount(initialCount);
  }
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const n = await fetchUnread(leadId);
      if (!cancelled && n !== null) setCount(n);
    }
    // Immediate fetch on mount closes the first-poll gap: messages that
    // arrived between SSR and mount are counted, not lost.
    void refresh();
    // A thread read in the same view refetches the server count instead of
    // optimistically zeroing (which the next poll would otherwise undo).
    function onRead(e: Event) {
      if ((e as CustomEvent).detail !== leadId) return;
      void refresh();
    }
    window.addEventListener(LEAD_READ_EVENT, onRead);
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener(LEAD_READ_EVENT, onRead);
    };
  }, [leadId]);
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${count} unread messages`}
      className="text-xs font-bold bg-ink text-white px-3 py-1 rounded-full"
    >
      • {count} new
    </span>
  );
}
