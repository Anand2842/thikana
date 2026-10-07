"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/client-request";
import type { LeadMessage } from "@/lib/mock-data";

// Poll cadence for the open thread: live enough to catch replies,
// cheap enough to keep on every open enquiry.
const POLL_MS = 15_000;

// NOTE: thread reads use plain fetch, not the shared `request()` helper —
// `request()` attaches a JSON body even for GET, and fetch throws
// ("Request with GET/HEAD method cannot have body"). Sends stay on
// `request()` since POST + JSON body is fine.
async function fetchThread(leadId: string): Promise<LeadMessage[]> {
  const res = await fetch(`/api/leads/${leadId}/messages`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not load messages.");
  return data.messages ?? [];
}

// Merge polled messages into state by id (append-only threads, no delete
// path), keeping chronological order. Replaces wholesale so edits would
// also converge, without clobbering locally-known rows between polls.
function mergeMessages(prev: LeadMessage[], next: LeadMessage[]) {
  if (prev.length === 0) return next;
  const seen = new Set(prev.map((m) => m.id)),
    merged = [...prev];
  for (const m of next)
    if (!seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  merged.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return merged;
}

// Event name inbox badges listen for: fired whenever a thread load with
// messages succeeds (which also marks the thread read server-side).
export const LEAD_READ_EVENT = "thikana:lead-read";

// Fire-and-forget read receipt: opening/viewing the thread marks it read
// up to now. Never blocks render; failures are swallowed and the next
// successful load retries the mark.
function markRead(leadId: string) {
  fetch(`/api/leads/${leadId}/read`, { method: "POST" }).catch(() => {});
  window.dispatchEvent(new CustomEvent(LEAD_READ_EVENT, { detail: leadId }));
}

async function loadInto(
  leadId: string,
  setItems: React.Dispatch<React.SetStateAction<LeadMessage[]>>,
  setError: (m: string) => void,
  loud: boolean,
) {
  try {
    const next = await fetchThread(leadId);
    setItems((prev) => mergeMessages(prev, next));
    if (next.length > 0) markRead(leadId);
  } catch (e) {
    if (loud) setError((e as Error).message);
    // Silent poll failures: the next tick retries; hard errors still
    // surface via the initial load and the manual reload after send.
  }
}

export default function LeadMessages({
  leadId,
  ownId,
}: {
  leadId: string;
  ownId: string;
}) {
  const [items, setItems] = useState<LeadMessage[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    await loadInto(leadId, setItems, setError, true);
  }
  useEffect(() => {
    let cancelled = false;
    const safeSetItems: React.Dispatch<
      React.SetStateAction<LeadMessage[]>
    > = (v) => {
      if (!cancelled) setItems(v);
    };
    const safeSetError = (m: string) => {
      if (!cancelled) setError(m);
    };
    void loadInto(leadId, safeSetItems, safeSetError, true);
    const t = setInterval(() => {
      if (document.hidden) return;
      void loadInto(leadId, safeSetItems, safeSetError, false);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [leadId]);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    // Capture the form synchronously: after any await the React synthetic
    // event is recycled and e.currentTarget may throw.
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const f = new FormData(form),
        body = String(f.get("body") ?? "");
      await request(`/api/leads/${leadId}/messages`, { body });
      form.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 w-full">
      <b className="text-sm">Messages</b>
      <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
        {items.map((m) => (
          <p
            key={m.id}
            className={`text-sm rounded-2xl px-3 py-2 ${
              m.senderId === ownId
                ? "bg-ink text-white ml-8"
                : "bg-paper border border-line mr-8"
            }`}
          >
            {m.body}
          </p>
        ))}
        {!items.length && !error && (
          <p className="text-xs text-ink/65">
            No messages yet. Say hello, propose a time, or confirm details.
          </p>
        )}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <label className="grow">
          <span className="sr-only">Write a message</span>
          <input
            name="body"
            required
            minLength={1}
            maxLength={2000}
            placeholder="Write a message…"
          />
        </label>
        <button className="button shrink-0" disabled={busy}>
          Send
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
