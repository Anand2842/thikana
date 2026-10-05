"use client";
import Link from "next/link";
import { useState } from "react";
import { request } from "@/lib/client-request";
export default function PropertyActions({
  id,
  signedIn,
  initialSaved,
}: {
  id: string;
  signedIn: boolean;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await request("/api/saved", { listingId: id, saved: !saved });
      setSaved(!saved);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      await request("/api/reports", {
        listingId: id,
        reason: f.get("reason"),
        details: f.get("details"),
      });
      setMessage("Report received. Our team will review it.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!signedIn)
    return (
      <Link
        href={`/auth?next=/properties/${id}`}
        className="button secondary block"
      >
        Sign in to save or report
      </Link>
    );
  return (
    <div className="bg-cream border border-line rounded-3xl p-5 space-y-4">
      <button
        className="button secondary w-full"
        aria-pressed={saved}
        disabled={busy}
        onClick={save}
      >
        {saved ? "♥ Saved · Remove" : "♡ Save home"}
      </button>
      <details>
        <summary className="font-bold text-sm cursor-pointer">
          Report this listing
        </summary>
        <form onSubmit={report} className="space-y-3 mt-3">
          <label>
            Reason
            <select name="reason">
              {[
                "Advance fee demand",
                "Wrong details",
                "Duplicate photos",
                "Unavailable property",
                "Other",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Describe the issue
            <textarea
              name="details"
              required
              minLength={10}
              maxLength={2000}
              rows={3}
            />
          </label>
          <button className="button w-full" disabled={busy}>
            Submit report
          </button>
        </form>
      </details>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
