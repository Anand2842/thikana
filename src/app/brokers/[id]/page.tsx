import Photo from "@/components/photo";
import { isActive } from "@/lib/trust";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchBroker,
  fetchBrokerListings,
  fetchReviews,
} from "@/lib/supabase/data";
import { VerifiedBadge } from "@/components/badges";
import ListingCard from "@/components/listing-card";

export default async function BrokerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const broker = await fetchBroker(id);
  if (!broker) notFound();
  const mine = (await fetchBrokerListings(broker.id)).filter(isActive);
  const revs = await fetchReviews(broker.id);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/brokers" className="text-[13px] font-bold text-ink/60">
        ← Back to directory
      </Link>
      <div className="mt-4 bg-ink text-white rounded-[28px] p-6 sm:p-8 grid lg:grid-cols-2 gap-6">
        <div className="flex gap-4 items-start">
          <Photo
            src={broker.photo}
            alt={broker.agency}
            className="w-16 sm:w-20 h-16 sm:h-20 shrink-0 rounded-3xl object-cover"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="display font-black text-[30px]">
                {broker.agency}
              </h1>
              <VerifiedBadge status={broker.verified} />
            </div>
            <div className="text-white/70 text-[13.5px]">
              {broker.name} · {broker.exp}y exp · {broker.tenure} ·{" "}
              {broker.cities.join(", ")}
            </div>
            <div className="mt-2 text-[13px] font-bold text-gold">
              ★ {broker.rating || "—"} ({broker.reviews})
            </div>
            <div className="mt-1 text-[12.5px] text-white/65">
              Response time: {broker.responseTime}
            </div>
          </div>
        </div>
        <div className="bg-white/[.07] border border-white/10 rounded-3xl p-5 text-[13.5px]">
          <b>Brokerage policy (public)</b>
          <p className="text-white/75 mt-1">{broker.policy}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {broker.areas.map((a) => (
              <span
                key={a}
                className="bg-white/10 px-3 py-1 rounded-full text-[12px] font-bold"
              >
                {a}
              </span>
            ))}
          </div>
          <div className="mt-2 text-white/60 text-[12.5px]">
            Verification: {broker.vdate || "Pending human review"}
          </div>
        </div>
      </div>
      <h2 className="display font-black text-[26px] mt-8">
        Active inventory ({mine.length})
      </h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mine.map((l) => (
          <ListingCard key={l.id} listing={l} broker={broker} />
        ))}
      </div>
      <h2 className="display font-black text-[26px] mt-8">
        Verified-visit reviews ({revs.length})
      </h2>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        {revs.map((r, i) => (
          <div key={i} className="bg-cream border border-line rounded-3xl p-5">
            <b className="text-[14px]">
              {"★".repeat(r.rating)}{" "}
              <span className="text-ink/50 font-mono text-[12px]">{r.tag}</span>
            </b>
            <p className="mt-2 text-[13.5px]">{r.text}</p>
            <div className="mt-2 text-[12px] text-ink/55 font-semibold">
              {r.user} · {r.date}
            </div>
          </div>
        ))}
        {revs.length === 0 && (
          <p className="text-ink/60 text-[14px]">
            No verified reviews yet — reviews unlock only after a verified
            visit.
          </p>
        )}
      </div>
    </main>
  );
}
