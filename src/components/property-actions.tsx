"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const params = useSearchParams();
  const [saved, setSaved] = useState(initialSaved),
    [saveBusy, setSaveBusy] = useState(false),
    [reportBusy, setReportBusy] = useState(false),
    [message, setMessage] = useState("");
  const resumed = useRef(false);
  async function save(next: boolean) {
    setSaveBusy(true);
    setMessage("");
    // Optimistic toggle with rollback: save is reversible, so the UI
    // responds instantly and only reverts on real failure.
    setSaved(next);
    try {
      await request("/api/saved", { listingId: id, saved: next });
    } catch (e) {
      setSaved(!next);
      setMessage((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }
  // Auth continuity: arriving back from sign-in with ?save=1 completes the
  // save the guest originally tapped, then cleans the URL.
  useEffect(() => {
    if (signedIn && !resumed.current && params.get("save") === "1" && !initialSaved) {
      resumed.current = true;
      router.replace(`/properties/${id}`);
      void save(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);
  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReportBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      await request("/api/reports", {
        listingId: id,
        reason: f.get("reason"),
        details: f.get("details"),
      });
      setMessage("Report received — our team reviews it within 48 hours.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  }
  if (!signedIn)
    return (
      <Link
        href={`/auth?next=${encodeURIComponent(`/properties/${id}?save=1`)}`}
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
        disabled={saveBusy}
        onClick={() => void save(!saved)}
      >
        {saveBusy ? "Saving…" : saved ? "♥ Saved · Remove" : "♡ Save home"}
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
          <button className="button w-full" disabled={reportBusy}>
            {reportBusy ? "Sending…" : "Submit report"}
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
