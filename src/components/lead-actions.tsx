"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import LeadMessages from "@/components/lead-messages";
import type { Lead } from "@/lib/mock-data";
import { LEAD_STAGES } from "@/lib/trust";
const manualStages: readonly string[] = LEAD_STAGES.filter(
  (s) => s !== "Visited" && s !== "Visit Scheduled",
);
export default function LeadActions({
  lead,
  manage,
  own,
  reviewed,
  ownId,
}: {
  lead: Lead;
  manage: boolean;
  own: boolean;
  reviewed: boolean;
  ownId: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(body: Record<string, unknown>, review = false) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await request(
        review ? "/api/reviews" : `/api/leads/${lead.id}`,
        review ? { ...body, leadId: lead.id } : body,
        review ? "POST" : "PATCH",
      );
      setMessage(review ? "Review published." : "Updated.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const confirmed = (own && lead.seekerVisited) || (!own && lead.brokerVisited);
  const proposed = !!lead.visitAt && !lead.visitAccepted;
  const proposedByMe = proposed && lead.visitProposedBy === ownId;
  const visitAgreed = !!lead.visitAt && !!lead.visitAccepted;
  return (
    <div className="mt-4 flex flex-wrap gap-3 items-start">
      {!lead.seekerVisited && !lead.brokerVisited && (
        <details className="w-full sm:w-auto">
          <summary className="text-sm font-bold cursor-pointer underline">
            {lead.visitAt ? "Reschedule visit" : "Schedule a visit"}
          </summary>
          <form
            className="space-y-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const at = new Date(String(f.get("visit")));
              if (Number.isFinite(at.getTime()))
                void run({ action: "schedule", visitAt: at.toISOString() });
            }}
          >
            <label>
              Visit date and time
              <input type="datetime-local" name="visit" required />
            </label>
            <button className="button" disabled={busy}>
              Save visit
            </button>
          </form>
        </details>
      )}
      {proposed && proposedByMe && (
        <span
          role="status"
          className="text-xs font-bold bg-mist border border-line px-3 py-2 rounded-full"
        >
          Proposed by you — awaiting other side
        </span>
      )}
      {proposed && !proposedByMe && (
        <button
          className="button"
          disabled={busy}
          onClick={() => run({ action: "accept" })}
        >
          Accept proposed visit
        </button>
      )}
      {visitAgreed && (
        <span className="text-xs font-bold bg-pine/10 border border-pine/25 px-3 py-2 rounded-full">
          Visit confirmed for{" "}
          {lead.visitAt
            ? new Date(lead.visitAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }) + " IST"
            : ""}
        </span>
      )}
      {lead.visitAt && !confirmed && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => run({ action: "confirm" })}
        >
          Confirm I visited
        </button>
      )}
      {lead.visitAt && (
        <span className="text-xs py-3">
          {lead.seekerVisited ? "Seeker confirmed" : "Awaiting seeker"} ·{" "}
          {lead.brokerVisited ? "Broker confirmed" : "Awaiting broker"}
        </span>
      )}
      {manage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              action: "status",
              status: f.get("status"),
              outcome: f.get("outcome") || undefined,
            });
          }}
          className="flex gap-2 items-end flex-wrap"
        >
          <label>
            Pipeline
            <select
              key={lead.status}
              name="status"
              required
              defaultValue={
                manualStages.includes(lead.status) ? lead.status : ""
              }
            >
              {!manualStages.includes(lead.status) && (
                <option value="" disabled>
                  {lead.status} · choose next stage
                </option>
              )}
              {manualStages.map((s) => (
                <option
                  key={s}
                  disabled={
                    s === "Negotiating" &&
                    !(lead.seekerVisited && lead.brokerVisited)
                  }
                >
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outcome (when closing)
            <select name="outcome" defaultValue={lead.outcome ?? ""}>
              <option value="">—</option>
              <option value="booked">Booked</option>
              <option value="not_interested">Not interested</option>
            </select>
          </label>
          <button className="button" disabled={busy}>
            Update stage
          </button>
        </form>
      )}
      {own &&
        lead.seekerVisited &&
        lead.brokerVisited &&
        (reviewed ? (
          <span className="text-sm text-pine py-3">Review published</span>
        ) : (
          <details className="w-full">
            <summary className="text-sm font-bold cursor-pointer underline">
              Write a verified-visit review
            </summary>
            <form
              className="mt-3 space-y-3 max-w-lg"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(
                  { rating: Number(f.get("rating")), text: f.get("text") },
                  true,
                );
              }}
            >
              <label>
                Rating
                <select name="rating">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Your experience
                <textarea
                  name="text"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <button className="button" disabled={busy}>
                Publish review
              </button>
            </form>
          </details>
        ))}
      {lead.visitAt && !(lead.seekerVisited && lead.brokerVisited) && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Cancel this scheduled visit? Both sides will see it as cancelled.",
              )
            )
              void run({ action: "cancel" });
          }}
        >
          Cancel visit
        </button>
      )}
      <LeadMessages leadId={lead.id} ownId={ownId} />
      {message && (
        <p role="status" className="w-full text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
