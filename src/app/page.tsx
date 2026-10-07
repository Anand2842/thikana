import Link from "next/link";
import type { Metadata } from "next";
import { fetchBrokers, fetchListings, fetchReviews } from "@/lib/supabase/data";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { inr, isActive, moveInTotal } from "@/lib/trust";
import ListingCard from "@/components/listing-card";
import BrokerCard from "@/components/broker-card";
import Photo from "@/components/photo";
import CityRequestForm from "@/components/city-request-form";

export const metadata: Metadata = {
  // Default mirrors the layout default; template appends "| Thikana" elsewhere.
  title: "NCR's Verified Broker Marketplace",
  description:
    "NCR property search across Delhi, Gurugram, Noida, Greater Noida & Ghaziabad — verified brokers, transparent charges & fresh availability.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [listings, brokers, reviews] = await Promise.all([
    fetchListings(),
    fetchBrokers(),
    fetchReviews(),
  ]);
  const byBroker = new Map(brokers.map((b) => [b.id, b])),
    active = listings.filter(
      (l) => isActive(l) && byBroker.get(l.brokerId)?.verified === "verified",
    ),
    verified = brokers.filter((b) => b.verified === "verified");
  const fresh = active.filter((l) => l.hrs < 24).slice(0, 6),
    hero = active[0];
  const localities = [
    ...new Set(active.map((l) => `${l.city}|${l.locality}`)),
  ].map((key) => {
    const [city, n] = key.split("|"),
      rows = active.filter((l) => l.city === city && l.locality === n);
    return {
      city,
      n,
      count: rows.length,
      rent: Math.min(...rows.map((l) => l.rent)),
      photo: rows[0]?.photos[0],
    };
  });
  const groups = new Map<string, typeof active>();
  for (const l of active)
    groups.set(l.propId, [...(groups.get(l.propId) ?? []), l]);
  const offers = [...groups.values()].find((g) => g.length > 1) ?? [];
  return (
    <div>
      <section className="overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 lg:pt-20 pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block bg-pine/10 text-pinedark rounded-full px-4 py-2 text-xs font-bold">
              NCR · 5 cities · Local brokers
            </div>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02] mt-6">
              Find a home.
              <br />
              <span className="text-pine">Know your broker.</span>
            </h1>
            <p className="text-ink/70 mt-5 leading-relaxed max-w-lg text-[17px]">
              Current availability, verified brokers and every charge up front.
              Compare the same home across brokers before you plan a visit.
            </p>
            <form
              action="/properties"
              className="mt-8 bg-white rounded-full p-2 pl-2 flex flex-col sm:flex-row sm:items-center gap-1 shadow-lift border border-ink/10 sm:rounded-full rounded-3xl"
            >
              <label className="flex-1 px-4 py-2 sm:border-r sm:border-ink/10">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-ink/50">
                  Where
                </span>
                <input
                  name="q"
                  maxLength={100}
                  placeholder="Dwarka, Sector 62, 2 BHK"
                  className="!border-0 !mt-0 !p-0 text-[14px] bg-transparent"
                />
              </label>
              <label className="px-4 py-2 sm:border-r sm:border-ink/10 sm:w-36">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-ink/50">
                  City
                </span>
                <select
                  name="city"
                  defaultValue=""
                  className="!border-0 !mt-0 !p-0 text-[14px] bg-transparent"
                >
                  <option value="">All NCR</option>
                  {PHASE1_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="px-4 py-2 sm:w-36">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-ink/50">
                  Max rent
                </span>
                <input
                  name="budget"
                  type="number"
                  min={1}
                  placeholder="₹ / month"
                  className="!border-0 !mt-0 !p-0 text-[14px] bg-transparent"
                />
              </label>
              <button
                className="bg-pine text-white font-bold rounded-full w-12 h-12 shrink-0 grid place-items-center text-xl max-sm:w-full max-sm:h-11"
                aria-label="Search homes"
              >
                →
              </button>
            </form>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
              <Link href="/brokers" className="underline underline-offset-4">
                Meet verified brokers →
              </Link>
              <Link href="/broker/onboard" className="underline underline-offset-4">
                List your property →
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink/55">
              {reviews.length} published reviews · Verification is granted after
              human review.
            </p>
          </div>
          {hero ? (
            <Link
              href={`/properties/${hero.id}`}
              className="relative rounded-[28px] overflow-hidden block shadow-lift group"
            >
              <Photo
                eager
                src={hero.photos[0]}
                alt={hero.title}
                className="w-full h-80 sm:h-[460px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-20 text-white">
                <div className="text-[11px] font-extrabold tracking-widest text-emerald-300">
                  AVAILABLE · VERIFIED BROKER
                </div>
                <div className="display text-2xl font-black mt-1">
                  {hero.title}
                </div>
                <div className="flex flex-wrap justify-between gap-3 mt-1 text-[14px]">
                  <span>
                    {hero.locality}, {hero.city}
                  </span>
                  <b>{inr(hero.rent)}/mo</b>
                </div>
                <span className="block mt-2 text-sm text-gold font-semibold">
                  Move-in estimate {inr(moveInTotal(hero))} · View all fees →
                </span>
              </div>
            </Link>
          ) : (
            <div className="border border-ink/15 rounded-[28px] p-10 bg-white">
              <h2 className="display text-3xl font-black">
                Your next address starts here.
              </h2>
              <p className="mt-4 text-ink/65">
                New homes appear after a broker and listing review.
              </p>
              <Link className="button inline-block mt-5" href="/brokers">
                Meet local brokers
              </Link>
            </div>
          )}
        </div>
        <div className="border-t border-ink/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              [active.length, "Available homes"],
              [verified.length, "Verified brokers"],
              [localities.length, "Localities"],
              [5, "NCR cities"],
            ].map(([v, n]) => (
              <div key={n} className="text-center">
                <div className="display text-3xl font-black">{v}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-ink/50 mt-1">
                  {n}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <section className="pt-12">
          <div className="eyebrow">YOUR NEIGHBOURHOOD, YOUR BUDGET</div>
          <h2 className="display text-3xl sm:text-4xl font-black mt-2">
            Explore NCR localities
          </h2>
          <div className="flex flex-wrap gap-2 mt-5">
            {PHASE1_CITIES.map((c) => (
              <Link
                key={c}
                href={`/properties?city=${encodeURIComponent(c)}`}
                className="button secondary"
              >
                {c} →
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {localities.slice(0, 8).map((l) => (
              <Link
                key={l.city + l.n}
                href={`/properties?city=${encodeURIComponent(l.city)}&locality=${encodeURIComponent(l.n)}`}
                className="group bg-white rounded-3xl overflow-hidden shadow-soft card-hover"
              >
                <div className="overflow-hidden">
                  <Photo
                    src={l.photo}
                    alt={l.n}
                    className="w-full h-32 object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-4">
                  <b>{l.n}</b>
                  <p className="text-xs text-pine font-bold mt-1">{l.city}</p>
                  <p className="text-xs text-ink/60 mt-1">
                    {l.count} homes · From {inr(l.rent)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="pt-12">
          <div className="flex flex-wrap justify-between gap-4 items-end">
            <h2 className="display text-3xl sm:text-4xl font-black">
              {fresh.length
                ? "Reconfirmed in the last 24 hours"
                : "Available homes"}
            </h2>
            <Link href="/properties" className="button secondary">
              Explore all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {(fresh.length ? fresh : active.slice(0, 6)).map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                broker={byBroker.get(l.brokerId)}
              />
            ))}
          </div>
        </section>
        {offers.length > 1 && (
          <section className="mt-12 bg-white border border-gold/50 rounded-[28px] p-5 sm:p-9 shadow-lift">
            <div className="eyebrow">ONE HOME · DIFFERENT OFFERS</div>
            <h2 className="display text-3xl font-black mt-2">
              Compare the fees before you decide.
            </h2>
            <p className="text-ink/65 mt-3">
              {offers[0].title} · {offers[0].locality} · {offers[0].propId}
            </p>
            <div className="space-y-3 mt-5">
              {offers.map((l) => (
                <div
                  key={l.id}
                  className="bg-paper border border-ink/10 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div>
                    <b>{byBroker.get(l.brokerId)?.agency}</b>
                    <p className="text-sm mt-1">
                      Rent {inr(l.rent)} · Brokerage {l.brokDays} days · Visit{" "}
                      {inr(l.visitFee)}
                    </p>
                    <p className="text-sm font-bold text-pine mt-1">
                      Move-in estimate: {inr(moveInTotal(l))}
                    </p>
                  </div>
                  <Link
                    className="button secondary"
                    href={`/properties/${l.id}`}
                  >
                    View offer
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="pt-12">
          <h2 className="display text-3xl sm:text-4xl font-black">
            Meet your local brokers
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {verified.slice(0, 4).map((b) => (
              <BrokerCard key={b.id} broker={b} />
            ))}
          </div>
        </section>
        <section className="py-12 grid lg:grid-cols-2 gap-6">
          <div className="bg-ink text-white rounded-3xl p-7 sm:p-10">
            <h2 className="display text-3xl font-black">
              Build your business on trust.
            </h2>
            <p className="text-white/70 mt-3">
              Show your policy, disclose every fee and keep availability
              current. Payment can never buy verification.
            </p>
            <Link
              className="button secondary inline-block mt-6"
              href="/broker/onboard"
            >
              Apply as a broker →
            </Link>
          </div>
          <div
            id="request-city"
            className="bg-cream border border-line rounded-3xl p-7"
          >
            <h2 className="display text-3xl font-black">
              Want Thikana in your city?
            </h2>
            <p className="text-ink/65 mt-2 mb-5">
              Tell us where you’re looking. We’ll use demand to plan our next
              city.
            </p>
            <CityRequestForm />
          </div>
        </section>
      </div>
    </div>
  );
}
