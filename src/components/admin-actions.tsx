"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const pill =
  "rounded-full text-[12px] font-extrabold px-4 py-1.5 transition disabled:opacity-50 disabled:cursor-wait";
const okBtn = `${pill} bg-pine text-white hover:opacity-90`;
const dangerBtn = `${pill} bg-red-600 text-white hover:opacity-90`;
const darkBtn = `${pill} bg-zinc-800 text-white hover:opacity-90`;

async function patch(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error) msg = data.error;
    } catch {
      // keep default message
    }
    throw new Error(msg);
  }
}

function useAction(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      await patch(url, body);
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
  return (
    <span className="flex flex-wrap gap-2">
      <button className={okBtn} disabled={disabled} onClick={() => run("approve", { action: "approve" })}>
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() => run("suspend", { action: "suspend" }, `Suspend broker ${id}? Their listings stay visible but flagged.`)}
      >
        {busy === "suspend" ? "…" : "Suspend"}
      </button>
      <button
        className={dangerBtn}
        disabled={disabled}
        onClick={() => run("reject", { action: "reject" }, `Reject broker ${id}? This deletes their application.`)}
      >
        {busy === "reject" ? "…" : "Reject"}
      </button>
    </span>
  );
}

export function ListingButtons({ id }: { id: string }) {
  const { busy, run, disabled } = useAction(`/api/listings/${id}`);
  return (
    <span className="flex flex-wrap gap-2">
      <button className={okBtn} disabled={disabled} onClick={() => run("approve", { action: "approve" })}>
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        className={darkBtn}
        disabled={disabled}
        onClick={() => run("expire", { action: "expire" }, `Expire listing ${id}? It will show as stale.`)}
      >
        {busy === "expire" ? "…" : "Expire"}
      </button>
      <button
        className={dangerBtn}
        disabled={disabled}
        onClick={() => run("flag", { action: "flag" }, `Flag listing ${id} for review?`)}
      >
        {busy === "flag" ? "…" : "Flag"}
      </button>
    </span>
  );
}

export function ReportButtons({ id, listingId }: { id: string; listingId: string }) {
  const { busy, run, disabled } = useAction(`/api/reports/${id}`);
  return (
    <span className="flex flex-wrap gap-2" title={`Report ${id} → listing ${listingId}`}>
      <button className={dangerBtn} disabled={disabled} onClick={() => run("uphold", { uphold: true })}>
        {busy === "uphold" ? "…" : "Uphold · flag listing"}
      </button>
      <button className={darkBtn} disabled={disabled} onClick={() => run("dismiss", { uphold: false })}>
        {busy === "dismiss" ? "…" : "Dismiss"}
      </button>
    </span>
  );
}
