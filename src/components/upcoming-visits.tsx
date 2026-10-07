"use client";
import type { Lead } from "@/lib/mock-data";
import { nowMs } from "@/lib/trust";

// Pure presentational list of agreed upcoming visits. No data fetching:
// the parent passes all visible leads plus a listing-id → title map, and
// this component filters (future + accepted), sorts soonest-first, renders.
export default function UpcomingVisits({
  leads,
  titles,
}: {
  leads: Lead[];
  titles: Map<string, string> | Record<string, string>;
}) {
  const titleOf = (id: string) =>
    titles instanceof Map ? (titles.get(id) ?? id) : (titles[id] ?? id);
  const visits = leads
    .filter(
      (l) =>
        typeof l.visitAt === "string" &&
        !!l.visitAccepted &&
        Date.parse(l.visitAt) > nowMs(),
    )
    .sort((a, b) => Date.parse(a.visitAt ?? "") - Date.parse(b.visitAt ?? ""));
  if (!visits.length)
    return <p className="text-sm text-ink/65">No upcoming visits.</p>;
  return (
    <div
      role="status"
      className="mt-4 bg-mist border border-pine/25 rounded-3xl p-5"
    >
      <b>Upcoming visits ({visits.length})</b>
      <ul className="mt-2 space-y-1 text-sm">
        {visits.map((l) => (
          <li key={l.id}>
            {titleOf(l.listingId)} ·{" "}
            {l.visitAt
              ? new Date(l.visitAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }) + " IST"
              : ""}{" "}
            · {l.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
