import Link from "next/link";
import { fetchBrokers, fetchLeadsSvc, fetchListings, fetchScopedLeads } from "@/lib/supabase/data";
import { freshness, inr } from "@/lib/trust";
import { VerificationPill } from "@/components/badges";
import ReconfirmButton from "@/components/reconfirm-button";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";

const DEFAULT_SESSION = "B1";

export default async function BrokerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paramBroker = typeof sp.broker === "string" ? sp.broker : undefined;
  // Signed-in brokers see their own dashboard (session wins). Everyone else —
  // logged-out demo, admins previewing brokers — uses ?broker= as before.
  const sessionUser = await getSessionUser();
  const sessionBrokerId = userBrokerId(sessionUser);
  const role = userRole(sessionUser);
  const requested =
    role === "broker" && sessionBrokerId
      ? sessionBrokerId
      : (paramBroker ?? DEFAULT_SESSION);
  const [brokers, scopedLeads, allListings] = await Promise.all([
    fetchBrokers(),
    // Brokers query only their own inbox; admins (previewing) read all then filter below.
    // Never fall back to the full table for unknown callers (this page is gated, but defense in depth).
    role === "admin"
      ? fetchLeadsSvc()
      : sessionUser
        ? fetchScopedLeads({ userId: sessionUser.id, role, brokerId: sessionBrokerId })
        : Promise.resolve([]),
    fetchListings(),
  ]);
  const allLeads = scopedLeads;
  const broker = brokers.find((b) => b.id === requested) ?? brokers.find((b) => b.id === DEFAULT_SESSION)!;
  const SESSION = broker.id;
  const mine = allListings.filter((l) => l.brokerId === SESSION);
  const inbox = allLeads.filter((l) => l.brokerId === SESSION);
  const listingById = new Map(allListings.map((l) => [l.id, l]));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">BROKER OS · {broker.agency}</div>
      <h1 className="display font-black text-[36px]">Good morning, {broker.name.split(" ")[0]}.</h1>
      <p className="text-ink/60 text-[14px]">Freshness is ranking. Reconfirm daily to stay on top. {mine.length} live · {inbox.length} leads in inbox.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold">
        <span className="py-2 text-ink/50">Demo session:</span>
        {brokers.filter((b) => b.verified === "verified").map((b) => (
          <Link
            key={b.id}
            href={`/broker/dashboard?broker=${b.id}`}
            className={`px-3 py-1.5 rounded-full border ${b.id === SESSION ? "bg-ink text-white border-ink" : "bg-cream border-line"}`}
          >
            {b.agency}
          </Link>
        ))}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Inventory freshness</h2>
      <div className="mt-3 space-y-2">
        {mine.map((l) => {
          const f = freshness(l);
          return (
            <div key={l.id} className="bg-cream border border-line rounded-2xl p-4 flex flex-wrap items-center gap-3 text-[13.5px]">
              <VerificationPill v={l.verification} />
              <b>{l.propId}</b><span>{l.bhk} BHK {l.locality} · {inr(l.rent)}/mo</span>
              <span className="text-ink/60 font-semibold">{f.label}</span>
              <span className="flex-1" />
              <ReconfirmButton listingId={l.id} propId={l.propId} />
            </div>
          );
        })}
      </div>

      <h2 className="font-extrabold text-[18px] mt-8">Lead inbox</h2>
      <div className="mt-3 space-y-2">
        {inbox.map((l) => (
          <div key={l.id} className="bg-paper border border-line rounded-2xl p-4 text-[13.5px]">
            <b>{l.id}</b> · {l.userName} · {listingById.get(l.listingId)?.propId} · {l.status}
            <div className="text-ink/60">{l.msg}</div>
          </div>
        ))}
        {inbox.length === 0 && <p className="text-ink/60">No leads yet.</p>}
        <div className="text-[12.5px] text-ink/55">Full pipeline ({allLeads.length} leads) — see <Link className="font-bold underline" href="/dashboard">seeker dashboard</Link>.</div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/broker/listings/new" className="bg-ink text-white font-bold text-[13.5px] px-6 py-3 rounded-2xl">+ New listing</Link>
        <Link href="/broker/onboard" className="border-2 border-ink font-bold text-[13.5px] px-6 py-3 rounded-2xl">Onboarding preview</Link>
      </div>
    </main>
  );
}
