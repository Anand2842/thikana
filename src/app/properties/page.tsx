import Link from "next/link";
import { fetchListings } from "@/lib/supabase/data";
import { PHASE1_CITIES } from "@/lib/mock-data";
import ListingCard from "@/components/listing-card";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : "All";
  const locality = typeof sp.locality === "string" ? sp.locality : "All";
  const sort = typeof sp.sort === "string" ? sp.sort : "fresh";

  const listings = await fetchListings();
  let rows = [...listings];
  if (city !== "All") rows = rows.filter((l) => l.city === city);
  if (locality !== "All") rows = rows.filter((l) => l.locality === locality);
  if (sort === "low") rows.sort((a, b) => a.rent - b.rent);
  else if (sort === "high") rows.sort((a, b) => b.rent - a.rent);
  else rows.sort((a, b) => a.hrs - b.hrs);

  const scoped = city === "All" ? listings : listings.filter((l) => l.city === city);
  const localities = ["All", ...Array.from(new Set(scoped.map((l) => l.locality)))];
  const base = { ...(city !== "All" ? { city } : {}), ...(locality !== "All" ? { locality } : {}) };
  const loc = (l: string) =>
    `/properties?${new URLSearchParams({ ...base, ...(l !== "All" ? { locality: l } : {}) }).toString()}`;
  const sortLink = (s: string) =>
    `/properties?${new URLSearchParams({ ...base, sort: s }).toString()}`;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">PROPERTY-FIRST DISCOVERY · NCR PHASE 1</div>
      <h1 className="display font-black text-[36px] tracking-tight">Know the fees first.</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/properties"
          className={`text-[12.5px] font-extrabold px-4 py-2 rounded-full border ${city === "All" ? "bg-pine text-white border-pine" : "bg-cream border-line"}`}
        >
          All NCR
        </Link>
        {PHASE1_CITIES.map((c) => (
          <Link
            key={c}
            href={`/properties?city=${encodeURIComponent(c)}`}
            className={`text-[12.5px] font-extrabold px-4 py-2 rounded-full border ${city === c ? "bg-pine text-white border-pine" : "bg-cream border-line"}`}
          >
            {c}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {localities.map((l) => (
          <Link
            key={l}
            href={loc(l)}
            className={`text-[12.5px] font-bold px-4 py-2 rounded-full border ${locality === l ? "bg-ink text-white border-ink" : "bg-cream border-line"}`}
          >
            {l}
          </Link>
        ))}
        <span className="flex-1" />
        <Link href={sortLink("fresh")} className="text-[12px] font-bold px-3 py-2">Freshest</Link>
        <Link href={sortLink("low")} className="text-[12px] font-bold px-3 py-2">Price ↑</Link>
        <Link href={sortLink("high")} className="text-[12px] font-bold px-3 py-2">Price ↓</Link>
      </div>
      <p className="mt-4 text-[13px] font-semibold text-ink/60">{rows.length} results{city !== "All" ? ` in ${city}` : " across NCR"} · flagged & stale de-ranked automatically</p>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>
    </main>
  );
}
