import Link from "next/link";
import { fetchListings, fetchBrokers } from "@/lib/supabase/data";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { isActive } from "@/lib/trust";
import ListingCard from "@/components/listing-card";
export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams,
    value = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const city = value("city") || "All",
    locality = value("locality") || "All",
    sort = value("sort") || "fresh",
    q = value("q").trim().toLowerCase();
  const [listings, brokers] = await Promise.all([
      fetchListings(),
      fetchBrokers(),
    ]),
    byBroker = new Map(brokers.map((b) => [b.id, b]));
  const active = listings.filter(
    (l) => isActive(l) && byBroker.get(l.brokerId)?.verified === "verified",
  );
  let rows = active.filter(
    (l) =>
      (city === "All" || l.city === city) &&
      (locality === "All" || l.locality === locality) &&
      (!value("bhk") || l.bhk === Number(value("bhk"))) &&
      (!value("budget") || l.rent <= Number(value("budget"))) &&
      (!value("furnishing") || l.furnishing === value("furnishing")) &&
      (!q ||
        `${l.title} ${l.city} ${l.locality} ${l.sector} ${l.bhk} BHK`
          .toLowerCase()
          .includes(q)),
  );
  rows = rows.sort((a, b) =>
    sort === "low"
      ? a.rent - b.rent
      : sort === "high"
        ? b.rent - a.rent
        : a.hrs - b.hrs,
  );
  const scoped = active.filter((l) => city === "All" || l.city === city),
    localities = ["All", ...new Set(scoped.map((l) => l.locality))];
  function link(change: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && v) params.set(k, v);
    for (const [k, v] of Object.entries(change))
      if (v && v !== "All") params.set(k, v);
      else params.delete(k);
    return `/properties?${params}`;
  }
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="eyebrow">AVAILABLE HOMES · VERIFIED BROKERS</div>
      <h1 className="display font-black text-4xl">Know the fees first.</h1>
      <form
        action="/properties"
        className="bg-cream border border-line rounded-3xl p-5 mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <label>
          Search
          <input
            name="q"
            defaultValue={value("q")}
            placeholder="Locality, sector or home"
            maxLength={100}
          />
        </label>
        <label>
          City
          <select name="city" defaultValue={city}>
            <option value="All">All NCR</option>
            {PHASE1_CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          BHK
          <select name="bhk" defaultValue={value("bhk")}>
            <option value="">Any BHK</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </label>
        <label>
          Maximum rent (₹)
          <input
            name="budget"
            type="number"
            min={1}
            max={10000000}
            defaultValue={value("budget")}
            placeholder="Any budget"
          />
        </label>
        <label>
          Furnishing
          <select name="furnishing" defaultValue={value("furnishing")}>
            <option value="">Any furnishing</option>
            {["Unfurnished", "Semi-Furnished", "Fully Furnished"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={sort}>
            <option value="fresh">Freshest</option>
            <option value="low">Price ↑</option>
            <option value="high">Price ↓</option>
          </select>
        </label>
        <div className="flex gap-2 items-end">
          <button className="button">Search homes</button>
          <Link className="button secondary" href="/properties">
            Reset
          </Link>
        </div>
      </form>
      <nav aria-label="Filter by city" className="mt-5 flex flex-wrap gap-2">
        {["All", ...PHASE1_CITIES].map((c) => (
          <Link
            key={c}
            href={link({ city: c, locality: "All" })}
            aria-current={city === c ? "page" : undefined}
            className={`text-xs font-bold px-4 py-2 rounded-full border ${city === c ? "bg-pine text-white border-pine" : "bg-cream border-line"}`}
          >
            {c === "All" ? "All NCR" : c}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Filter by locality"
        className="mt-3 flex flex-wrap gap-2"
      >
        {localities.map((l) => (
          <Link
            key={l}
            href={link({ locality: l })}
            aria-current={locality === l ? "page" : undefined}
            className={`text-xs font-bold px-4 py-2 rounded-full border ${locality === l ? "bg-ink text-white border-ink" : "bg-cream border-line"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-ink/65">
        {rows.length} available homes · All charges disclosed · Reconfirmed
        within 7 days
      </p>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            broker={byBroker.get(l.brokerId)}
          />
        ))}
      </div>
      {!rows.length && (
        <div className="mt-6 bg-cream border border-line rounded-3xl p-10 text-center">
          <h2 className="display font-black text-2xl">No homes match yet.</h2>
          <p className="mt-2">Try a nearby locality or a wider budget.</p>
          <Link className="button inline-block mt-5" href="/properties">
            Clear filters
          </Link>
        </div>
      )}
    </main>
  );
}
