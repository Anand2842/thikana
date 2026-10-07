"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";

const pill =
  "rounded-full text-[12px] font-extrabold px-4 py-1.5 transition disabled:opacity-50 disabled:cursor-wait";
const okBtn = `${pill} bg-pine text-white hover:opacity-90`;
const dangerBtn = `${pill} bg-red-600 text-white hover:opacity-90`;
const darkBtn = `${pill} bg-zinc-800 text-white hover:opacity-90`;

function useAction(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (
    key: string,
    body: Record<string, unknown>,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      await request(url, body, "PATCH");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };
  return { busy, run, disabled: busy !== null };
}

export function BrokerButtons({ id }: { id: string }) {
  const { busy, run, disabled } = useAction(`/api/brokers/${id}`);
  const [note, setNote] = useState("");
  const payload = (action: string) => ({ action, note: note.trim() });
  return (
    <span className="flex flex-wrap gap-2 items-center">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Moderation note (optional)"
        maxLength={500}
        aria-label="Moderation note"
        className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-medium min-w-[180px] flex-1"
      />
      <button
        className={okBtn}
        disabled={disabled}
        onClick={() => run("approve", payload("approve"))}
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() =>
          run(
            "suspend",
            payload("suspend"),
            `Suspend broker ${id}? Their listings will be flagged and enquiries disabled.`,
          )
        }
      >
        {busy === "suspend" ? "…" : "Suspend"}
      </button>
      <button
        className={dangerBtn}
        disabled={disabled}
        onClick={() =>
          run(
            "reject",
            payload("reject"),
            `Reject broker ${id}? Their application will be suspended and kept for review.`,
          )
        }
      >
        {busy === "reject" ? "…" : "Reject"}
      </button>
    </span>
  );
}

export function ListingButtons({ id }: { id: string }) {
  const { busy, run, disabled } = useAction(`/api/listings/${id}`);
  const [note, setNote] = useState("");
  const payload = (action: string) => ({ action, note: note.trim() });
  return (
    <span className="flex flex-wrap gap-2 items-center">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Moderation note (optional)"
        maxLength={500}
        aria-label="Moderation note"
        className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-medium min-w-[180px] flex-1"
      />
      <button
        className={okBtn}
        disabled={disabled}
        onClick={() => run("approve", payload("approve"))}
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() =>
          run(
            "expire",
            payload("expire"),
            `Expire listing ${id}? It will show as stale.`,
          )
        }
      >
        {busy === "expire" ? "…" : "Expire"}
      </button>
      <button
        className={dangerBtn}
        disabled={disabled}
        onClick={() => run("flag", payload("flag"), `Flag listing ${id} for review?`)}
      >
        {busy === "flag" ? "…" : "Flag"}
      </button>
    </span>
  );
}

export function ReportButtons({
  id,
  listingId,
  brokerId,
  targetType,
  notes,
}: {
  id: string;
  listingId: string;
  brokerId?: string | null;
  targetType?: string;
  notes?: { id: string; body: string; createdAt: string }[];
}) {
  const { busy, run, disabled } = useAction(`/api/reports/${id}`);
  const [note, setNote] = useState("");
  const isBroker = targetType === "broker";
  return (
    <span
      className="flex flex-wrap gap-2"
      title={`Report ${id} → ${isBroker ? `broker ${brokerId}` : `listing ${listingId}`}`}
    >
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() => run("investigate", { status: "Investigating" })}
      >
        {busy === "investigate" ? "…" : "Mark investigating"}
      </button>
      <button
        className={dangerBtn}
        disabled={disabled}
        onClick={() =>
          run(
            "uphold",
            { uphold: true },
            isBroker
              ? "Uphold will suspend this broker. Continue?"
              : "Uphold will flag this listing. Continue?",
          )
        }
      >
        {busy === "uphold" ? "…" : isBroker ? "Uphold · suspend broker" : "Uphold · flag listing"}
      </button>
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() => run("dismiss", { uphold: false })}
      >
        {busy === "dismiss" ? "…" : "Dismiss"}
      </button>
      <form
        className="flex gap-2 items-center w-full mt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run("note", { body: String(f.get("body") ?? "") }).then(() =>
            e.currentTarget.reset(),
          );
        }}
      >
        <label className="grow">
          <span className="sr-only">Investigation note</span>
          <input
            name="body"
            required
            minLength={2}
            maxLength={2000}
            placeholder="Evidence request, progress, resolution reason…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className={darkBtn} disabled={disabled}>
          Add note
        </button>
      </form>
      {!!notes?.length && (
        <ul className="w-full space-y-1 text-[12px]">
          {notes.map((n) => (
            <li key={n.id} className="text-ink/70">
              <span className="font-mono text-ink/45">
                {n.createdAt.slice(0, 10)}
              </span>{" "}
              {n.body}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
