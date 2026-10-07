"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { LEAD_STAGES } from "@/lib/trust";
import type { Lead, Listing } from "@/lib/mock-data";
import LeadActions from "@/components/lead-actions";
import UpcomingVisits from "@/components/upcoming-visits";
import InboxUnreadBadge from "@/components/inbox-unread-badge";

type SortKey = "newest" | "oldest" | "visit";

function titleOf(listings: Listing[], listingId: string) {
  return listings.find((l) => l.id === listingId)?.title ?? `Listing ${listingId}`;
}

// Close-with-outcome: same PATCH as LeadActions' status flow, but includes
// `outcome` when status is Closed. W-D persists `outcome` in that route.
function CloseWithOutcome({ lead }: { lead: Lead }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function close(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const outcome = String(new FormData(e.currentTarget).get("outcome") ?? "");
      await request(`/api/leads/${lead.id}`, {
        action: "status",
        status: "Closed",
        outcome,
      }, "PATCH");
      setMessage("Closed.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={close} className="flex gap-2 items-end flex-wrap">
      <label>
        Outcome
        <select name="outcome" required defaultValue={lead.outcome ?? "booked"}>
          <option value="booked">booked</option>
          <option value="not_interested">not_interested</option>
        </select>
      </label>
      <button className="button secondary" disabled={busy}>
        {lead.status === "Closed" ? "Update outcome" : "Close with outcome"}
      </button>
      {lead.outcome && (
        <span className="text-xs py-3">Outcome: {lead.outcome}</span>
      )}
      {message && (
        <p role="status" className="w-full text-sm">
          {message}
        </p>
      )}
    </form>
  );
}

export default function LeadInbox({
  leads,
  listings,
  userId,
  unread,
}: {
  leads: Lead[];
  listings: Listing[];
  userId: string;
  unread?: Record<string, number>;
}) {
  const [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("All"),
    [sort, setSort] = useState<SortKey>("newest");
  const presentStages = useMemo(
    () => LEAD_STAGES.filter((s) => leads.some((l) => l.status === s)),
    [leads],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((l) => {
      if (statusFilter !== "All" && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.userName, l.msg, l.status, titleOf(listings, l.listingId)].some(
        (v) => (v ?? "").toLowerCase().includes(q),
      );
    });
    const byDateDesc = (a: Lead, b: Lead) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    if (sort === "oldest") return [...filtered].sort((a, b) => -byDateDesc(a, b));
    if (sort === "visit")
      return [...filtered].sort((a, b) => {
        const at = a.visitAt ? Date.parse(a.visitAt) : NaN,
          bt = b.visitAt ? Date.parse(b.visitAt) : NaN;
        if (Number.isFinite(at) && Number.isFinite(bt)) return at - bt;
        if (Number.isFinite(at)) return -1;
        if (Number.isFinite(bt)) return 1;
        return byDateDesc(a, b);
      });
    return [...filtered].sort(byDateDesc);
  }, [leads, listings, query, statusFilter, sort]);
  return (
    <div>
      <UpcomingVisits
        leads={leads}
        titles={Object.fromEntries(listings.map((l) => [l.id, l.title]))}
      />
      <div className="flex flex-wrap gap-3 mt-4">
        <label className="grow min-w-52">
          <span className="sr-only">Search enquiries</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, message, property, status…"
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All</option>
            {presentStages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="visit">Visit soonest</option>
          </select>
        </label>
      </div>
      <div className="space-y-3 mt-4">
        {visible.map((l) => (
          <article
            key={l.id}
            className="bg-cream border border-line rounded-3xl p-5"
          >
            <b>{l.userName}</b>{" "}
            <InboxUnreadBadge leadId={l.id} initialCount={unread?.[l.id] ?? 0} />
            <p className="text-sm mt-2">
              <Link
                className="underline font-bold"
                href={`/properties/${l.listingId}`}
              >
                {titleOf(listings, l.listingId)}
              </Link>
            </p>
            <p className="text-sm mt-2">
              {l.phone} · {l.status}
            </p>
            <p className="text-sm text-ink/65 mt-2">{l.msg}</p>
            {!!l.req?.trim() && (
              <p className="text-sm mt-2">Requirements: {l.req}</p>
            )}
            {!!l.time?.trim() && (
              <p className="text-sm text-ink/65 mt-1">Preferred time: {l.time}</p>
            )}
            <p className="text-sm mt-2">
              Visit:{" "}
              {l.visitAt
                ? new Date(l.visitAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }) + " IST"
                : "Not scheduled"}
            </p>
            <CloseWithOutcome lead={l} />
            <LeadActions
              lead={l}
              manage
              own={false}
              reviewed={false}
              ownId={userId}
            />
          </article>
        ))}
        {!visible.length && (
          <p className="text-sm text-ink/65">
            {leads.length
              ? "No enquiries match this search."
              : "No enquiries yet."}
          </p>
        )}
      </div>
    </div>
  );
}
