"use client";
import { useState } from "react";
import { request } from "@/lib/client-request";
export default function ReportReplyForm({ reportId }: { reportId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const f = new FormData(e.currentTarget);
      await request(`/api/reports/${reportId}/notes`, {
        body: String(f.get("body") ?? ""),
      });
      e.currentTarget.reset();
      setMessage("Reply sent. Our team will review it.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="w-full mt-2">
      <summary className="text-xs font-bold cursor-pointer underline">
        Reply with evidence
      </summary>
      <form onSubmit={reply} className="mt-2 flex gap-2">
        <label className="grow">
          <span className="sr-only">Evidence reply</span>
          <input
            name="body"
            required
            minLength={2}
            maxLength={2000}
            placeholder="Add details or evidence…"
          />
        </label>
        <button className="button shrink-0" disabled={busy}>
          Send
        </button>
      </form>
      {message && (
        <p role="status" className="text-xs mt-1">
          {message}
        </p>
      )}
    </details>
  );
}
