import Link from "next/link";
import { fetchBrokers, fetchListings } from "@/lib/supabase/data";
import { localities, PHASE1_CITIES } from "@/lib/mock-data";
import { inr } from "@/lib/trust";
import ListingCard from "@/components/listing-card";
import BrokerCard from "@/components/broker-card";
import CityRequestForm from "@/components/city-request-form";

export default async function Home() {
  const [listings, brokers] = await Promise.all([fetchListings(), fetchBrokers()]);
  const fresh = [...listings].filter((l) => l.verification === "verified").sort((a, b) => a.hrs - b.hrs).slice(0, 6);
  const verifiedListings = listings.filter((l) => l.verification === "verified");
  const verifiedBrokers = brokers.filter((b) => b.verified === "verified");
  const topBrokers = brokers.filter((b) => b.verified === "verified").slice(0, 4);
  const dup = listings.filter((l) => l.propId === "DL-DWK-004821");

  return (
    <main>
      {/* HERO */}
      <div className="bg-ink text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full pl-1.5 pr-4 py-1.5 text-[12.5px] font-semibold mb-5">
              <span className="bg-emerald-400 text-ink text-[11px] font-extrabold px-2.5 py-1 rounded-full">NCR · PHASE 1</span>
              <span className="text-white/85">5 cities · {localities.length} localities · Live freshness</span>
            </div>
            <h1 className="display font-black text-[42px] sm:text-[58px] leading-[.95] tracking-tight">
              Find property.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-gold to-saffron">Know your broker.</span>
            </h1>
            <p className="mt-4 text-white/70 text-[15.5px] leading-relaxed max-w-xl">
              NCR property search with <b className="text-white">verified brokers, transparent charges & fresh availability.</b> No bait listings. No hidden brokerage. No wasted visits.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/properties" className="bg-white text-ink font-extrabold text-[13.5px] px-6 py-3 rounded-full hover:bg-emerald-300 transition">Find Properties</Link>
              <Link href="/brokers" className="border border-white/25 font-extrabold text-[13.5px] px-6 py-3 rounded-full hover:bg-white/10 transition">Find Verified Brokers</Link>
            </div>
            <div className="mt-5 text-[13px]"><span className="text-gold font-extrabold">★★★★★ 4.7/5</span> <span className="text-white/70">· 2,340 verified reviews · <b className="text-white">92% would recommend</b></span></div>
          </div>
          <div className="relative hidden md:block">
            <div className="relative rounded-[28px] overflow-hidden border border-white/15 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listings[0].photos[0]} className="w-full h-[420px] object-cover" alt="Verified Delhi home" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <div className="bg-white/95 rounded-2xl p-4 text-ink">
                  <div className="flex justify-between items-start">
                    <div><div className="font-extrabold text-[17px]">2 BHK Apartment · Dwarka Sec-12</div><div className="text-[13px] text-ink/60 font-medium">1,050 sq.ft · Semi-Furnished · Parking</div></div>
                    <div className="text-right"><div className="display font-black text-[22px]">{inr(24000)}<span className="text-[12px] font-sans font-semibold text-ink/50">/mo</span></div><div className="text-[11.5px] font-bold text-pine">Brokerage 15 days · Visit ₹0</div></div>
                  </div>
                  <Link href="/properties/L001" className="mt-3 block text-center bg-ink text-white text-[12.5px] font-bold px-4 py-2.5 rounded-xl hover:bg-pine transition">View Property</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div><div className="display font-black text-[26px] text-emerald-300">{verifiedListings.length}</div><div className="text-[11.5px] font-bold tracking-widest uppercase text-white/60">Live verified listings</div></div>
            <div><div className="display font-black text-[26px]">{verifiedBrokers.length}</div><div className="text-[11.5px] font-bold tracking-widest uppercase text-white/60">Verified brokers</div></div>
            <div><div className="display font-black text-[26px] text-gold">{localities.length}</div><div className="text-[11.5px] font-bold tracking-widest uppercase text-white/60">Localities live</div></div>
            <div><div className="display font-black text-[26px] text-emerald-300">{PHASE1_CITIES.length}</div><div className="text-[11.5px] font-bold tracking-widest uppercase text-white/60">NCR cities · Phase 1</div></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="pt-12">
          <h2 className="display font-black text-[32px] sm:text-[40px] tracking-tight">Popular NCR localities</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PHASE1_CITIES.map((c) => (
              <Link key={c} href={`/properties?city=${encodeURIComponent(c)}`} className="text-[12.5px] font-bold px-4 py-2 rounded-full bg-ink text-white hover:bg-pine transition">{c} →</Link>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {localities.map((l) => (
              <Link key={l.n} href={`/properties?city=${encodeURIComponent(l.city)}&locality=${encodeURIComponent(l.n)}`} className="bg-cream border border-line rounded-3xl overflow-hidden card-hover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.img} alt={l.n} className="w-full h-28 object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <b className="text-[15px]">{l.n}</b>
                    <span className="text-[12px] font-bold text-ink/60">{l.avg} · {l.c}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-extrabold tracking-widest text-pine">{l.city.toUpperCase()}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-12">
          <div className="flex items-end justify-between">
            <h2 className="display font-black text-[32px] sm:text-[40px] tracking-tight">Verified in the last 24 hours</h2>
            <Link href="/properties" className="text-[13px] font-bold border border-ink rounded-full px-5 py-2.5 hover:bg-ink hover:text-white transition">Explore all →</Link>
          </div>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fresh.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </div>

        <div className="pt-12">
          <h2 className="display font-black text-[32px] sm:text-[40px] tracking-tight">Verified brokers across NCR</h2>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topBrokers.map((b) => <BrokerCard key={b.id} broker={b} />)}
          </div>
        </div>

        <div className="pt-12">
          <div className="rounded-[28px] border border-line bg-cream p-6 sm:p-10">
            <span className="text-[11px] font-extrabold tracking-[.2em] bg-saffron/10 text-saffrondark border border-saffron/30 px-3 py-1.5 rounded-full">ANTI-FRAUD · PROPERTY IDENTITY</span>
            <h3 className="display font-black text-[28px] mt-4">Same property — {dup.length} verified brokers.</h3>
            <p className="text-ink/60 text-[14.5px] mt-2">One permanent property ID <span className="font-mono font-bold">DL-DWK-004821</span>. Compare brokerage before you decide.</p>
            <div className="mt-4 space-y-2">
              {dup.map((l) => (
                <div key={l.id} className="bg-paper border border-line rounded-2xl p-3 flex items-center justify-between text-[13px]">
                  <span><b>{inr(l.rent)}/mo</b> · {l.brok} brokerage · Visit {l.visitFee === 0 ? "₹0" : `₹${l.visitFee}`}</span>
                  <Link href={`/properties/${l.id}`} className="font-bold border border-ink px-3 py-1.5 rounded-full">View</Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="py-12 grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="text-center lg:text-left bg-ink text-white rounded-[28px] p-8 flex flex-col justify-center">
            <h2 className="display font-black text-[30px]">Brokers grow. Verification stays unbought.</h2>
            <p className="text-white/65 text-[14px] mt-2 font-semibold">Payment can never buy verification. Users always free.</p>
            <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-3">
              <Link href="/broker/onboard" className="bg-white text-ink font-bold text-[13.5px] px-6 py-3 rounded-2xl">Start free as broker</Link>
              <Link href="/properties/L007" className="border border-white/25 font-bold text-[13.5px] px-6 py-3 rounded-2xl">See how flags work →</Link>
            </div>
          </div>
          <div id="request-city" className="bg-cream border border-line rounded-[28px] p-8">
            <div className="text-[11px] font-extrabold tracking-[.2em] text-pine uppercase">Not in NCR? · Expansion is demand-driven</div>
            <h2 className="display font-black text-[28px] mt-2">Want Thikana in your city?</h2>
            <p className="text-ink/60 text-[13.5px] mt-1 font-medium">Tell us where — we open new cities where demand stacks up.</p>
            <div className="mt-4"><CityRequestForm /></div>
          </div>
        </div>
      </div>
    </main>
  );
}

