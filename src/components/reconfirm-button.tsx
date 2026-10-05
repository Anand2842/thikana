"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReconfirmButton({ listingId, propId }: { listingId: string; propId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/reconfirm`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg(`${propId} reconfirmed — ranking restored.`);
      router.refresh();
    } catch {
      setMsg("Reconfirm failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        className="text-[12px] font-extrabold bg-pine text-white px-4 py-2 rounded-full disabled:opacity-50"
      >
        {busy ? "Working…" : "Reconfirm now"}
      </button>
      {msg && <span className="text-[12px] font-semibold text-pinedark">{msg}</span>}
    </span>
  );
}
