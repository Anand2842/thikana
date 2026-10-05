import Link from "next/link";
import { fetchBrokers } from "@/lib/supabase/data";
import { PHASE1_CITIES } from "@/lib/mock-data";
import BrokerCard from "@/components/broker-card";

export default async function BrokersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : "All";
  const brokers = await fetchBrokers();
  const scoped = city === "All" ? brokers : brokers.filter((b) => b.cities.includes(city));
  const verified = scoped.filter((b) => b.verified === "verified");
  const others = scoped.filter((b) => b.verified !== "verified");
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">THE BROKER IS THE TRUST ANCHOR</div>
      <h1 className="display font-black text-[36px] tracking-tight">Verified brokers{city === "All" ? " across NCR" : ` in ${city}`}</h1>
      <p className="text-ink/60 text-[14px] font-medium mt-2">Payment can never buy verification. {verified.length} verified · {others.length} pending/flagged shown separately.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/brokers" className={`text-[12.5px] font-extrabold px-4 py-2 rounded-full border ${city === "All" ? "bg-pine text-white border-pine" : "bg-cream border-line"}`}>All NCR</Link>
        {PHASE1_CITIES.map((c) => (
          <Link key={c} href={`/brokers?city=${encodeURIComponent(c)}`} className={`text-[12.5px] font-extrabold px-4 py-2 rounded-full border ${city === c ? "bg-pine text-white border-pine" : "bg-cream border-line"}`}>{c}</Link>
        ))}
      </div>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {verified.map((b) => <BrokerCard key={b.id} broker={b} />)}
      </div>
      <h2 className="display font-black text-[24px] mt-10">Pending & flagged (transparency)</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 opacity-95">
        {others.map((b) => <BrokerCard key={b.id} broker={b} />)}
      </div>
    </main>
  );
}
