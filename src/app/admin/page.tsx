import { fetchBrokers, fetchListings, fetchLeadsSvc, fetchReportsSvc, fetchCityRequestsSvc } from "@/lib/supabase/data";
import { VerificationPill } from "@/components/badges";
import { BrokerButtons, ListingButtons, ReportButtons } from "@/components/admin-actions";

export default async function AdminPage() {
  const [brokers, listings, reports, leads, cityRequests] = await Promise.all([
    fetchBrokers(),
    fetchListings(),
    fetchReportsSvc(),
    fetchLeadsSvc(),
    fetchCityRequestsSvc(),
  ]);
  const byCity = new Map<string, number>();
  for (const r of cityRequests) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  const demand = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
  const pendingBrokers = brokers.filter((b) => b.verified === "pending");
  const flagged = listings.filter((l) => l.verification === "flagged");
  const pendingListings = listings.filter((l) => l.verification === "pending");
  const stale = listings.filter((l) => l.verification === "stale");

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">TRUST OPERATIONS</div>
      <h1 className="display font-black text-[36px]">Admin moderation</h1>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
        {[["Pending brokers", pendingBrokers.length], ["Flagged listings", flagged.length], ["Pending listings", pendingListings.length], ["Open reports", reports.length]].map(([k, v]) => (
          <div key={k as string} className="bg-cream border border-line rounded-2xl p-4"><div className="display font-black text-[26px]">{v}</div><div className="text-[11px] font-bold uppercase tracking-widest text-ink/55">{k}</div></div>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Broker approvals ({pendingBrokers.length})</h2>
      <div className="mt-3 space-y-2">
        {pendingBrokers.map((b) => (
          <div key={b.id} className="bg-cream border border-line rounded-2xl p-4 text-[13.5px] flex flex-wrap gap-2 items-center">
            <b>{b.agency}</b><span>{b.name} · {b.kyc}</span><span className="flex-1" />
            <BrokerButtons id={b.id} />
          </div>
        ))}
        {pendingBrokers.length === 0 && <p className="text-ink/60">Queue clear.</p>}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Flagged listings ({flagged.length})</h2>
      <div className="mt-3 space-y-2">
        {flagged.map((l) => (
          <div key={l.id} className="bg-red-50/50 border border-red-200 rounded-2xl p-4 text-[13.5px]">
            <VerificationPill v={l.verification} /> <b className="ml-2">{l.propId} · {l.bhk} BHK {l.locality} · ₹{l.rent}</b>
            <div className="text-red-800 mt-1">{l.flags?.join(" · ")}</div>
            <div className="mt-2"><ListingButtons id={l.id} /></div>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Pending listings ({pendingListings.length})</h2>
      <div className="mt-3 space-y-2">
        {pendingListings.map((l) => (
          <div key={l.id} className="bg-cream border border-line rounded-2xl p-4 text-[13.5px]">
            <VerificationPill v={l.verification} /> <b className="ml-2">{l.propId} · {l.bhk} BHK {l.locality} · ₹{l.rent}</b>
            <div className="mt-2"><ListingButtons id={l.id} /></div>
          </div>
        ))}
        {pendingListings.length === 0 && <p className="text-ink/60">Queue clear.</p>}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Expansion demand — city requests ({cityRequests.length})</h2>
      <p className="text-[13px] text-ink/60 font-medium">Open where demand stacks up. Phase 1 covers Delhi · Gurugram · Noida · Greater Noida · Ghaziabad.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {demand.map(([c, n]) => (
          <span key={c} className="bg-saffron/10 border border-saffron/30 text-saffrondark text-[13px] font-extrabold px-4 py-2 rounded-full">{c} · {n}</span>
        ))}
        {demand.length === 0 && <p className="text-ink/60">No requests yet.</p>}
      </div>
      <div className="mt-3 space-y-2">
        {cityRequests.map((r) => (
          <div key={r.id} className="bg-paper border border-line rounded-2xl p-4 text-[13px]">
            <b>{r.city}</b> · {r.name} ({r.userType}) · {r.status}<div className="text-ink/60">{r.note || r.date}</div>
          </div>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Reports ({reports.length}) · Leads ({leads.length})</h2>
      <div className="mt-3 grid lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-paper border border-line rounded-2xl p-4 text-[13px]">
              <b>{r.id}</b> · {r.reason} → {r.listingId}<div className="text-ink/60">{r.details} · {r.status}</div>
              {!r.status.startsWith("Resolved") && (
                <div className="mt-2"><ReportButtons id={r.id} listingId={r.listingId} /></div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="bg-paper border border-line rounded-2xl p-4 text-[13px]">
              <b>{l.id}</b> · {l.userName} → {l.brokerId}<div className="text-ink/60">{l.status} · {l.visit}</div>
            </div>
          ))}
        </div>
      </div>

      {stale.length > 0 && <p className="mt-6 text-[12.5px] text-ink/55">Stale ({stale.length}) auto-expire via <span className="font-mono">POST /api/cron/expire</span>.</p>}
    </main>
  );
}
