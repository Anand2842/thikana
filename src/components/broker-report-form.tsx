"use client";
import Link from "next/link";
import { useState } from "react";
import { request } from "@/lib/client-request";
import { REPORT_REASONS } from "@/lib/validation";
export default function BrokerReportForm({
  brokerId,
  brokerName,
  signedIn,
}: {
  brokerId: string;
  brokerName: string;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      await request("/api/reports", {
        targetType: "broker",
        brokerId,
        reason: f.get("reason"),
        details: f.get("details"),
      });
      setMessage(
        `Report about ${brokerName} received. Our team will review it.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!signedIn)
    return (
      <Link
        href={`/auth?next=/brokers/${brokerId}`}
        className="button secondary block"
      >
        Sign in to report this broker
      </Link>
    );
  return (
    <div className="bg-cream border border-line rounded-3xl p-5">
      <details>
        <summary className="font-bold text-sm cursor-pointer">
          Report this broker
        </summary>
        <form onSubmit={report} className="space-y-3 mt-3">
          <label>
            Reason
            <select name="reason">
              {REPORT_REASONS.map((s) => (
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
        <p role="status" className="text-sm mt-3">
          {message}
        </p>
      )}
    </div>
  );
}
