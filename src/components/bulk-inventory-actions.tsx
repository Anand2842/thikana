"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";

// Bulk availability for the broker's own listings: tick homes, choose one
// explicit action. One stable request ID per click makes double-clicks and
// retries replay instead of duplicating; per-item conflicts surface inline.
const ACTIONS = [
  { id: "available", label: "Available" },
  { id: "taken", label: "Taken" },
  { id: "onhold", label: "On Hold" },
  { id: "reconfirm", label: "Reconfirm checked" },
] as const;

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `web-${Date.now()}`;
  }
}

export interface BulkListing {
  id: string;
  title: string;
  revision: number;
  verification: string;
  availabilityStatus?: string;
}

export default function BulkInventoryActions({
  listings,
}: {
  listings: BulkListing[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<
    { listingId: string; ok: boolean; error?: string }[]
  >([]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: string) {
    const items = listings
      .filter((l) => selected.has(l.id))
      .slice(0, 20)
      .map((l) => ({ listingId: l.id, expectedRevision: l.revision }));
    if (!items.length) {
      setMessage("Select homes first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      const data = await request("/api/broker/inventory/actions", {
        requestId: newRequestId(),
        action,
        items,
      });
      setResults(data.results ?? []);
      const failed = (data.results ?? []).filter(
        (r: { ok: boolean }) => !r.ok,
      ).length;
      setMessage(
        failed
          ? `${(data.results ?? []).length - failed} updated, ${failed} need attention.`
          : `Updated ${(data.results ?? []).length} home${(data.results ?? []).length === 1 ? "" : "s"}.`,
      );
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!listings.length) return null;
  return (
    <div className="bg-paper border border-line rounded-2xl p-4 mt-4">
      <b className="text-sm">Bulk availability ({selected.size} selected)</b>
      <ul className="mt-2 space-y-1 max-h-56 overflow-auto text-[13px]">
        {listings.map((l) => (
          <li key={l.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
              />
              <span className="flex-1 truncate">{l.title}</span>
              <span className="text-ink/55 text-[12px]">
                {l.availabilityStatus ?? ""} · {l.verification}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-3">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            className="button secondary"
            disabled={busy || selected.size === 0}
            onClick={() => void run(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm mt-2">
          {message}
        </p>
      )}
      {results.length > 0 && (
        <ul className="text-[12px] mt-2 space-y-1" aria-label="Action results">
          {results.map((r) => (
            <li key={r.listingId} className={r.ok ? "" : "text-red-700"}>
              {r.listingId.slice(0, 8)}: {r.ok ? "updated" : r.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
