import Link from "next/link";
import { fetchBrokers, fetchListings, fetchReviews } from "@/lib/supabase/data";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { inr, isActive, moveInTotal } from "@/lib/trust";
import ListingCard from "@/components/listing-card";
import BrokerCard from "@/components/broker-card";
import Photo from "@/components/photo";
import CityRequestForm from "@/components/city-request-form";
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
    <main>
      <section className="bg-ink text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs font-bold">
              NCR · 5 cities · Local brokers
            </div>
            <h1 className="display text-5xl sm:text-6xl font-black tracking-tight leading-[1.02] mt-6">
              Find a home.
              <br />
              <span className="text-gold">Know your broker.</span>
            </h1>
            <p className="text-white/75 mt-5 leading-relaxed max-w-lg">
              Current availability, verified brokers and every charge up front.
              Compare the same home across brokers before you plan a visit.
            </p>
            <form
              action="/properties"
              className="mt-7 bg-white rounded-2xl p-2 flex flex-wrap sm:flex-nowrap gap-2"
            >
              <label className="grow text-ink">
                <span className="sr-only">Search homes</span>
                <input
                  name="q"
                  maxLength={100}
                  placeholder="Try Dwarka, Sector 62 or 2 BHK"
                  className="!border-0 !mt-0"
                />
              </label>
              <button className="button shrink-0">Find homes →</button>
            </form>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <Link href="/brokers" className="underline">
                Meet verified brokers →
              </Link>
              <Link href="/broker/onboard" className="underline">
                List your property →
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/65">
              {reviews.length} published reviews · Verification is granted after
              human review.
            </p>
          </div>
          {hero ? (
            <Link
              href={`/properties/${hero.id}`}
              className="relative rounded-3xl overflow-hidden border border-white/20 block"
            >
              <Photo
                eager
                src={hero.photos[0]}
                alt={hero.title}
                className="w-full h-80 sm:h-[420px] object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-5 pt-20">
                <div className="text-xs font-bold text-emerald-300">
                  AVAILABLE · VERIFIED BROKER
                </div>
                <h2 className="display text-2xl font-black mt-2">
                  {hero.title}
                </h2>
                <div className="flex flex-wrap justify-between gap-3 mt-2">
                  <span>
                    {hero.locality}, {hero.city}
                  </span>
                  <b>{inr(hero.rent)}/mo</b>
                </div>
                <span className="block mt-3 text-sm text-gold">
                  Move-in estimate {inr(moveInTotal(hero))} · View all fees →
                </span>
              </div>
            </Link>
          ) : (
            <div className="border border-white/20 rounded-3xl p-10">
              <h2 className="display text-3xl font-black">
                Your next address starts here.
              </h2>
              <p className="mt-4">
                New homes appear after a broker and listing review.
              </p>
              <Link className="button inline-block mt-5" href="/brokers">
                Meet local brokers
              </Link>
            </div>
          )}
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              [active.length, "Available homes"],
              [verified.length, "Verified brokers"],
              [localities.length, "Localities"],
              [5, "NCR cities"],
            ].map(([v, n]) => (
              <div key={n} className="text-center">
                <div className="display text-3xl font-black text-gold">{v}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-white/65 mt-1">
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
                className="bg-cream border border-line rounded-3xl overflow-hidden card-hover"
              >
                <Photo
                  src={l.photo}
                  alt={l.n}
                  className="w-full h-28 object-cover"
                />
                <div className="p-4">
                  <b>{l.n}</b>
                  <p className="text-xs text-pine font-bold mt-1">{l.city}</p>
                  <p className="text-xs text-ink/65 mt-2">
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
          <section className="mt-12 bg-cream border-2 border-gold rounded-3xl p-5 sm:p-9">
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
                  className="bg-paper border border-line rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3"
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
    </main>
  );
}
