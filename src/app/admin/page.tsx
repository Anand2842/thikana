import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchBrokers,
  fetchListings,
  fetchLeadsSvc,
  fetchReportsSvc,
  fetchCityRequestsSvc,
} from "@/lib/supabase/data";
import { VerificationPill } from "@/components/badges";
import {
  BrokerButtons,
  ListingButtons,
  ReportButtons,
} from "@/components/admin-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/admin");
  if (userRole(user) !== "admin") redirect("/dashboard");
  const db = createServiceClient();
  const { data: applications, error: appError } = await db
    .from("broker_applications")
    .select("*");
  if (appError) throw appError;
  const proofs = new Map<
    string,
    { phone: string; identity: string; business: string }
  >();
  for (const a of applications ?? []) {
    const [identity, business] = await Promise.all([
      db.storage.from("broker-proofs").createSignedUrl(a.identity_path, 300),
      db.storage.from("broker-proofs").createSignedUrl(a.business_path, 300),
    ]);
    if (identity.error || business.error)
      throw new Error("Could not load verification documents.");
    proofs.set(a.broker_id, {
      phone: a.phone,
      identity: identity.data?.signedUrl ?? "",
      business: business.data?.signedUrl ?? "",
    });
  }
  const { data: addresses, error: addressError } = await db
    .from("listing_addresses")
    .select("*");
  if (addressError) throw addressError;
  const addressById = new Map(
    (addresses ?? []).map((a) => [a.listing_id, a.address]),
  );
  const [brokers, listings, reports, leads, cityRequests] = await Promise.all([
    fetchBrokers(),
    fetchListings(),
    fetchReportsSvc(),
    fetchLeadsSvc(),
    fetchCityRequestsSvc(),
  ]);
  const byCity = new Map<string, number>();
  for (const r of cityRequests)
    byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  const demand = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
  const pendingBrokers = brokers.filter((b) => b.verified === "pending");
  const flagged = listings.filter((l) => l.verification === "flagged");
  const pendingListings = listings.filter((l) => l.verification === "pending");
  const stale = listings.filter((l) => l.verification === "stale");

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">
        TRUST OPERATIONS
      </div>
      <h1 className="display font-black text-[36px]">Admin moderation</h1>
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

      <h2 className="font-extrabold text-[18px] mt-8">
        Broker approvals ({pendingBrokers.length})
      </h2>
      <div className="mt-3 space-y-2">
        {pendingBrokers.map((b) => (
          <div
            key={b.id}
            className="bg-cream border border-line rounded-2xl p-4 text-[13.5px] flex flex-wrap gap-2 items-center"
          >
            <b>{b.agency}</b>
            <span>
              {b.name} · {b.kyc}
            </span>
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
          </div>
        ))}
        {pendingBrokers.length === 0 && (
          <p className="text-ink/60">Queue clear.</p>
        )}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Broker directory</h2>
      <div className="mt-3 space-y-2">
        {brokers
          .filter((b) => b.verified !== "pending")
          .map((b) => (
            <div
              key={b.id}
              className="bg-cream border border-line rounded-2xl p-4 flex flex-wrap gap-3 items-center"
            >
              <Link className="underline font-bold" href={`/brokers/${b.id}`}>
                {b.agency}
              </Link>
              <span>{b.verified}</span>
              <BrokerButtons id={b.id} />
            </div>
          ))}
      </div>
      <h2 className="font-extrabold text-[18px] mt-8">
        Flagged listings ({flagged.length})
      </h2>
      <div className="mt-3 space-y-2">
        {flagged.map((l) => (
          <div
            key={l.id}
            className="bg-red-50/50 border border-red-200 rounded-2xl p-4 text-[13.5px]"
          >
            <VerificationPill v={l.verification} />{" "}
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
        {pendingListings.map((l) => (
          <div
            key={l.id}
            className="bg-cream border border-line rounded-2xl p-4 text-[13.5px]"
          >
            <VerificationPill v={l.verification} />{" "}
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
        {listings
          .filter((l) => ["verified", "stale"].includes(l.verification))
          .map((l) => (
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
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-paper border border-line rounded-2xl p-4 text-[13px]"
            >
              <b>{r.id}</b> · {r.reason} → {r.listingId}
              <div className="text-ink/60">
                {r.details} · {r.status}
              </div>
              {!r.status.startsWith("Resolved") && (
                <div className="mt-2">
                  <ReportButtons id={r.id} listingId={r.listingId} />
                </div>
              )}
            </div>
          ))}
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
