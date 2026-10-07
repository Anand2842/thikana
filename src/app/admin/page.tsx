import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssurance, getSessionUser, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchAdminActions,
  fetchApplicantChecks,
  fetchBrokers,
  fetchListingsSvc,
  fetchLeadsSvc,
  fetchReportNotes,
  fetchReportsSvc,
  fetchCityRequestsSvc,
  type KycCheck,
} from "@/lib/supabase/data";
import { VerificationPill } from "@/components/badges";
import {
  BrokerButtons,
  ListingButtons,
  ReportButtons,
} from "@/components/admin-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function OpenReportPill({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="bg-red-100 text-red-700 border border-red-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
      {n} open report{n === 1 ? "" : "s"}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/admin");
  if (userRole(user) !== "admin") redirect("/dashboard");
  const { current } = await getAssurance();
  if (current !== "aal2") redirect("/admin/mfa");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const queue = typeof sp.queue === "string" ? sp.queue : "all";
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const PAGE_SIZE = 20;
  const db = createServiceClient();
  const { data: applications, error: appError } = await db
    .from("broker_applications")
    .select("*");
  if (appError) throw appError;
  const applicationByBroker = new Map((applications ?? []).map(a => [a.broker_id, a]));
  // One bad document or applicant lookup must never abort the whole
  // console: each item resolves independently, failures degrade to unchecked.
  const proofs = new Map<
    string,
    { phone: string; identity: string; business: string }
  >();
  await Promise.all(
    (applications ?? []).map(async (a) => {
      try {
        const [identity, business] = await Promise.all([
          db.storage.from("broker-proofs").createSignedUrl(a.identity_path, 300),
          db.storage.from("broker-proofs").createSignedUrl(a.business_path, 300),
        ]);
        if (identity.error || business.error) return;
        proofs.set(a.broker_id, {
          phone: a.phone,
          identity: identity.data?.signedUrl ?? "",
          business: business.data?.signedUrl ?? "",
        });
      } catch {
        return;
      }
    }),
  );
  const { data: addresses, error: addressError } = await db
    .from("listing_addresses")
    .select("*");
  if (addressError) throw addressError;
  const addressById = new Map(
    (addresses ?? []).map((a) => [a.listing_id, a.address]),
  );
  const [brokers, listings, reports, leads, cityRequests, decisions] =
    await Promise.all([
      fetchBrokers(),
      fetchListingsSvc(),
      fetchReportsSvc(),
      fetchLeadsSvc(),
      fetchCityRequestsSvc(),
      fetchAdminActions(20),
    ]);
  // Applicant KYC checks resolve independently — one auth lookup failure
  // leaves that row unchecked instead of aborting the queue.
  const pendingBrokerIds = brokers
    .filter((b) => b.verified === "pending")
    .map((b) => b.id);
  const checkResults = await Promise.all(
    pendingBrokerIds.map(async (id) => {
      try {
        return [id, await fetchApplicantChecks(id)] as const;
      } catch {
        return [
          id,
          {
            hasIdentity: false,
            hasBusiness: false,
            emailConfirmed: false,
            phoneConfirmed: false,
            phoneOtpStatus: "Phone OTP verification needs an SMS provider.",
            hasAddress: false,
            missing: ["check unavailable — retry"],
          } as KycCheck,
        ] as const;
      }
    }),
  );
  const checksByBroker = new Map(checkResults);
  const reportNotes = await fetchReportNotes(
    reports.map((r) => r.id),
  ).catch(() => []);
  const notesByReport = new Map<string, typeof reportNotes>();
  for (const n of reportNotes) {
    const arr = notesByReport.get(n.reportId) ?? [];
    arr.push(n);
    notesByReport.set(n.reportId, arr);
  }
  const byCity = new Map<string, number>();
  for (const r of cityRequests)
    byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  const demand = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
  const pendingBrokers = brokers.filter((b) => b.verified === "pending");
  const flagged = listings.filter((l) => l.verification === "flagged");
  const pendingListings = listings.filter((l) => l.verification === "pending");
  const stale = listings.filter((l) => l.verification === "stale");
  // Open-report counts derived inline from the service-role reports already
  // loaded above (no data.ts change). "Open" mirrors the queue below: any
  // status not starting with "Resolved".
  const openByListing = new Map<string, number>();
  const openByBroker = new Map<string, number>();
  const brokerByListing = new Map<string, string>();
  for (const l of listings) brokerByListing.set(l.id, l.brokerId);
  for (const r of reports) {
    if (r.status.startsWith("Resolved")) continue;
    if (r.listingId) {
      openByListing.set(r.listingId, (openByListing.get(r.listingId) ?? 0) + 1);
      const bId = brokerByListing.get(r.listingId);
      if (bId) openByBroker.set(bId, (openByBroker.get(bId) ?? 0) + 1);
    }
    if (r.brokerId) openByBroker.set(r.brokerId, (openByBroker.get(r.brokerId) ?? 0) + 1);
  }
  // Real KPIs computed from live data (not just queue counts).
  // Real KPIs, computed from events — formulas in the section tooltips below.
  // Active inventory excludes Taken/OnHold (unavailable homes are not supply).
  const activeListings = listings.filter(
    (l) =>
      l.verification === "verified" &&
      l.availabilityStatus !== "Taken" &&
      l.availabilityStatus !== "OnHold",
  );
  const freshShare = activeListings.length
    ? Math.round(
        (activeListings.filter((l) => l.hrs < 24).length / activeListings.length) * 100,
      )
    : 0;
  // Response: broker's first reply/message or pipeline move within 24h of the
  // enquiry's creation. Timestamp-proven rows must meet the window; rows
  // without timestamps (legacy) fall back to status movement only.
  const respondedShare = leads.length
    ? Math.round(
        (leads.filter((l) => {
          if (l.firstResponseAt && l.createdAt)
            return (
              Date.parse(l.firstResponseAt) - Date.parse(l.createdAt) <=
              24 * 3_600_000
            );
          if (!l.createdAt) return l.status !== "New";
          return false;
        }).length /
          leads.length) *
          100,
      )
    : 0;
  // Conversion (enquiry → scheduled visit): an agreed or completed visit, or a
  // booked close. Unaccepted proposals and not-interested closes don't count.
  const convertedShare = leads.length
    ? Math.round(
        (leads.filter(
          (l) =>
            l.visitAccepted ||
            l.seekerVisited ||
            l.brokerVisited ||
            ["Visited", "Negotiating"].includes(l.status) ||
            (l.status === "Closed" && l.outcome === "booked"),
        ).length /
          leads.length) *
          100,
      )
    : 0;
  const resolvedShare = reports.length
    ? Math.round(
        (reports.filter((r) => r.status.startsWith("Resolved")).length / reports.length) * 100,
      )
    : 0;
  const suspicious =
    flagged.length +
    stale.length +
    reports.filter(
      (r) => !r.status.startsWith("Resolved") && r.reason === "Duplicate photos",
    ).length;
  // Queue search/filter/pagination (server-rendered, in-memory slice).
  const matchQ = (s: string) => !q || s.toLowerCase().includes(q);
  const inQueue = (section: string) => queue === "all" || queue === section;
  const pageOf = <T,>(rows: T[]) => ({
    total: rows.length,
    rows: rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE),
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">
        TRUST OPERATIONS
      </div>
      <h1 className="display font-black text-[36px]">Admin moderation</h1>
      <nav aria-label="Staff responsibilities" className="flex flex-wrap gap-4 mt-3 text-sm font-bold">
        <Link className="underline" href="/admin/policy">Staff policy</Link>
        <Link className="underline" href="/admin/privacy-requests">Privacy &amp; appeals queue</Link>
      </nav>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
        {[
          ["Pending brokers", pendingBrokers.length],
          ["Flagged listings", flagged.length],
          ["Pending listings", pendingListings.length],
          [
            "Open reports",
            reports.filter((r) => !r.status.startsWith("Resolved")).length,
          ],
        ].map(([k, v]) => (
          <div
            key={k as string}
            className="bg-cream border border-line rounded-2xl p-4"
          >
            <div className="display font-black text-[26px]">{v}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink/55">
              {k}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <form method="GET" className="flex flex-wrap gap-2">
          <label className="grow min-w-52">
            <span className="sr-only">Search queues</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search agency, name, property ID, locality, reason…"
            />
          </label>
          <label>
            Queue
            <select name="queue" defaultValue={queue}>
              {["all", "brokers", "listings", "reports"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="button shrink-0">Filter</button>
        </form>
      </div>

      <h2 className="display text-2xl font-black mt-8">
        Key indicators
      </h2>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3 text-center">
        {[
          [
            `Freshness ${freshShare}%`,
            "verified <24h",
            "Confirmed within 24h ÷ active listings (Taken/On Hold excluded)",
          ],
          [
            `Response ${respondedShare}%`,
            "replied <24h",
            "First broker reply within 24h of enquiry creation",
          ],
          [
            `Conversion ${convertedShare}%`,
            "to agreed visit",
            "Agreed/completed visits + booked closes ÷ enquiries (proposals and not-interested excluded)",
          ],
          [
            `Resolved ${resolvedShare}%`,
            "complaints closed",
            "Resolved reports ÷ all reports",
          ],
          [
            `${suspicious}`,
            "suspicious items",
            "Flagged + stale listings + open duplicate-photo reports",
          ],
        ].map(([v, k, tip]) => (
          <div
            key={k as string}
            className="bg-cream border border-line rounded-2xl p-4"
            title={tip as string}
          >
            <div className="display font-black text-[24px]">{v}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink/55">
              {k}
            </div>
          </div>
        ))}
      </div>

      <h2 className="display text-2xl font-black mt-8">
        Recent decisions ({decisions.length})
      </h2>
      <div className="mt-3 space-y-2">
        {decisions.map((d) => (
          <div
            key={d.id}
            className="bg-paper border border-line rounded-2xl p-4 text-[13px]"
          >
            <b>{d.action}</b> · {d.targetType} {d.targetId}
            {d.detail && <div className="text-ink/60">{d.detail}</div>}
            <div className="text-ink/45 font-mono text-[11px]">
              {d.createdAt.slice(0, 16).replace("T", " ")}
            </div>
          </div>
        ))}
        {!decisions.length && (
          <p className="text-ink/60 text-sm">No moderation decisions recorded yet.</p>
        )}
      </div>
      <h2 className="font-extrabold text-[18px] mt-8">
        Broker approvals ({pendingBrokers.length})
      </h2>
      <div className="mt-3 space-y-2">
        {pageOf(
          pendingBrokers.filter((b) =>
            inQueue("brokers") &&
            matchQ(`${b.agency} ${b.name} ${b.id} ${b.kyc}`),
          ),
        ).rows.map((b) => (
          <div
            key={b.id}
            className="bg-cream border border-line rounded-2xl p-4 text-[13.5px] flex flex-wrap gap-2 items-center"
          >
            <b>{b.agency}</b>
            <span>
              {b.name} · {b.kyc}
            </span>
            <OpenReportPill n={openByBroker.get(b.id) ?? 0} />
            <span className="flex-1" />
            {proofs.get(b.id) && (
              <span className="flex flex-wrap gap-3 text-xs">
                <span>{proofs.get(b.id)?.phone}</span>
                <a
                  className="underline"
                  href={proofs.get(b.id)?.identity}
                  target="_blank"
                  rel="noreferrer"
                >
                  Identity proof
                </a>
                <a
                  className="underline"
                  href={proofs.get(b.id)?.business}
                  target="_blank"
                  rel="noreferrer"
                >
                  Business proof
                </a>
              </span>
            )}
            <BrokerButtons id={b.id} />
            <div className="w-full text-xs text-ink/70">
              {([
                ["Agreement accepted", applicationByBroker.get(b.id)?.agreement_version, applicationByBroker.get(b.id)?.agreement_accepted_at],
                ["Verification consent", applicationByBroker.get(b.id)?.privacy_version, applicationByBroker.get(b.id)?.verification_consented_at],
              ] as const).map(([label, version, at]) => <p key={label}>{label}: {version && at ? `${version} · ${new Date(at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Not recorded for this application — do not infer historic acceptance."}</p>)}
            </div>
            <span className="w-full text-xs text-ink/70">
              Checks:{" "}
              {(
                [
                  ["ID proof", checksByBroker.get(b.id)?.hasIdentity],
                  ["Business proof", checksByBroker.get(b.id)?.hasBusiness],
                  ["Email confirmed", checksByBroker.get(b.id)?.emailConfirmed],
                  ["Address on file", checksByBroker.get(b.id)?.hasAddress],
                ] as const
              ).map(([label, done]) => (
                <span key={label} className="mr-3">
                  <span aria-hidden>{done ? "✓" : "○"}</span> {label}
                </span>
              ))}
              <span className="mr-3 text-amber-700" title="Phone OTP needs an SMS provider before numbers can be OTP-verified.">
                ○ Phone OTP pending provider
              </span>
              {(checksByBroker.get(b.id)?.missing.length ?? 0) > 0 && (
                <span className="text-red-700 font-bold">
                  Missing: {checksByBroker.get(b.id)?.missing.join(", ")}
                </span>
              )}
            </span>
          </div>
        ))}
        {pendingBrokers.length === 0 && (
          <p className="text-ink/60">Queue clear.</p>
        )}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Broker directory</h2>
      <div className="mt-3 space-y-2">
        {pageOf(
          brokers.filter(
            (b) =>
              b.verified !== "pending" &&
              inQueue("brokers") &&
              matchQ(`${b.agency} ${b.name} ${b.id} ${b.verified}`),
          ),
        ).rows.map((b) => (
            <div
              key={b.id}
              className="bg-cream border border-line rounded-2xl p-4 flex flex-wrap gap-3 items-center"
            >
              <Link className="underline font-bold" href={`/brokers/${b.id}`}>
                {b.agency}
              </Link>
              <span>{b.verified}</span>
              <OpenReportPill n={openByBroker.get(b.id) ?? 0} />
              <BrokerButtons id={b.id} />
            </div>
          ))}
      </div>
      <h2 className="font-extrabold text-[18px] mt-8">
        Flagged listings ({flagged.length})
      </h2>
      <div className="mt-3 space-y-2">
        {pageOf(
          flagged.filter(
            (l) =>
              inQueue("listings") &&
              matchQ(`${l.propId} ${l.locality} ${l.title} ${l.id}`),
          ),
        ).rows.map((l) => (
          <div
            key={l.id}
            className="bg-red-50/50 border border-red-200 rounded-2xl p-4 text-[13.5px]"
          >
            <VerificationPill v={l.verification} />{" "}
            <OpenReportPill n={openByListing.get(l.id) ?? 0} />
            <b className="ml-2">
              {l.propId} · {l.bhk} BHK {l.locality} · ₹{l.rent}
            </b>
            <div className="text-red-800 mt-1">{l.flags?.join(" · ")}</div>
            <p className="mt-2">
              Address: {addressById.get(l.id) || "Sample catalog home"}
            </p>
            <Link className="underline block mt-2" href={`/properties/${l.id}`}>
              Review full listing →
            </Link>
            <div className="mt-2">
              <ListingButtons id={l.id} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">
        Pending listings ({pendingListings.length})
      </h2>
      <div className="mt-3 space-y-2">
        {pageOf(
          pendingListings.filter(
            (l) =>
              inQueue("listings") &&
              matchQ(`${l.propId} ${l.locality} ${l.title} ${l.id}`),
          ),
        ).rows.map((l) => (
          <div
            key={l.id}
            className="bg-cream border border-line rounded-2xl p-4 text-[13.5px]"
          >
            <VerificationPill v={l.verification} />{" "}
            <OpenReportPill n={openByListing.get(l.id) ?? 0} />
            <b className="ml-2">
              {l.propId} · {l.bhk} BHK {l.locality} · ₹{l.rent}
            </b>
            <p className="mt-2">
              Address: {addressById.get(l.id) || "Sample catalog home"}
            </p>
            <Link className="underline block mt-2" href={`/properties/${l.id}`}>
              Review full listing →
            </Link>
            <div className="mt-2">
              <ListingButtons id={l.id} />
            </div>
          </div>
        ))}
        {pendingListings.length === 0 && (
          <p className="text-ink/60">Queue clear.</p>
        )}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">
        Published & stale inventory
      </h2>
      <div className="space-y-2 mt-3">
        {pageOf(
          listings.filter(
            (l) =>
              ["verified", "stale"].includes(l.verification) &&
              matchQ(`${l.title} ${l.locality} ${l.propId} ${l.id}`),
          ),
        ).rows.map((l) => (
            <div
              key={l.id}
              className="bg-cream border border-line rounded-2xl p-4 flex flex-wrap gap-3 items-center"
            >
              <Link
                className="underline font-bold"
                href={`/properties/${l.id}`}
              >
                {l.title} · {l.locality}
              </Link>
              <VerificationPill v={l.verification} />
              <OpenReportPill n={openByListing.get(l.id) ?? 0} />
              <ListingButtons id={l.id} />
            </div>
          ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">
        Expansion demand — city requests ({cityRequests.length})
      </h2>
      <p className="text-[13px] text-ink/60 font-medium">
        Open where demand stacks up. Phase 1 covers Delhi · Gurugram · Noida ·
        Greater Noida · Ghaziabad.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {demand.map(([c, n]) => (
          <span
            key={c}
            className="bg-saffron/10 border border-saffron/30 text-saffrondark text-[13px] font-extrabold px-4 py-2 rounded-full"
          >
            {c} · {n}
          </span>
        ))}
        {demand.length === 0 && <p className="text-ink/60">No requests yet.</p>}
      </div>
      <div className="mt-3 space-y-2">
        {cityRequests.map((r) => (
          <div
            key={r.id}
            className="bg-paper border border-line rounded-2xl p-4 text-[13px]"
          >
            <b>{r.city}</b> · {r.name} ({r.userType}) · {r.status}
            <div className="text-ink/60">{r.note || r.date}</div>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">
        Reports ({reports.length}) · Leads ({leads.length})
      </h2>
      <div className="mt-3 grid lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          {pageOf(
            reports.filter(
              (r) =>
                inQueue("reports") &&
                matchQ(
                  `${r.id} ${r.reason} ${r.details} ${r.status} ${r.listingId} ${r.brokerId ?? ""}`,
                ),
            ),
          ).rows.map((r) => {
            const sameProp =
              r.listingId !== ""
                ? listings.filter(
                    (l) =>
                      l.id !== r.listingId &&
                      l.propId ===
                        listings.find((x) => x.id === r.listingId)?.propId,
                  )
                : [];
            const thread = notesByReport.get(r.id) ?? [];
            return (
              <div
                key={r.id}
                className="bg-paper border border-line rounded-2xl p-4 text-[13px]"
              >
                <b>{r.id}</b> · {r.reason} →{" "}
                {r.targetType === "broker" ? (
                  <Link
                    className="underline font-bold"
                    href={`/brokers/${r.brokerId}`}
                  >
                    broker {r.brokerId}
                  </Link>
                ) : (
                  <Link
                    className="underline font-bold"
                    href={`/properties/${r.listingId}`}
                  >
                    {r.listingId}
                  </Link>
                )}
                <div className="text-ink/60">
                  {r.details} · {r.status}
                </div>
                {sameProp.length > 0 && (
                  <div className="mt-2 text-[12.5px]">
                    <b>Same property on record:</b>{" "}
                    {sameProp.map((l) => (
                      <span key={l.id} className="mr-2">
                        <Link
                          className="underline"
                          href={`/properties/${l.id}`}
                        >
                          {l.propId}
                        </Link>{" "}
                        ({l.bhk} BHK · ₹{l.rent} · {l.verification})
                      </span>
                    ))}
                    <span className="text-ink/55">
                      Review both sides before expiring either.
                    </span>
                  </div>
                )}
                {!!thread.length && (
                  <ul className="mt-2 space-y-1 text-[12px]">
                    {thread.map((n) => (
                      <li key={n.id} className="text-ink/70">
                        <span className="font-mono text-ink/45">
                          {n.createdAt.slice(0, 16).replace("T", " ")}
                        </span>{" "}
                        {n.body}
                      </li>
                    ))}
                  </ul>
                )}
                {!r.status.startsWith("Resolved") && (
                  <div className="mt-2">
                    <ReportButtons
                      id={r.id}
                      listingId={r.listingId}
                      brokerId={r.brokerId}
                      targetType={r.targetType}
                      notes={thread.map((n) => ({
                        id: n.id,
                        body: n.body,
                        createdAt: n.createdAt,
                      }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {leads.map((l) => (
            <div
              key={l.id}
              className="bg-paper border border-line rounded-2xl p-4 text-[13px]"
            >
              <b>{l.id}</b> · {l.userName} → {l.brokerId}
              <div className="text-ink/60">
                {l.status} · {l.visit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {stale.length > 0 && (
        <p className="mt-6 text-[12.5px] text-ink/55">
          Stale ({stale.length}) homes are hidden from search until their broker
          reconfirms.
        </p>
      )}
    </main>
  );
}
