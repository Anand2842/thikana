import Photo from "./photo";
import Link from "next/link";
import type { Broker } from "@/lib/mock-data";
import { VerifiedBadge } from "./badges";

export default function BrokerCard({ broker }: { broker: Broker }) {
  return (
    <Link
      href={`/brokers/${broker.id}`}
      className="bg-cream border border-line rounded-3xl p-5 card-hover block"
    >
      <div className="flex items-center gap-3">
        <Photo
          src={broker.photo}
          alt={broker.agency}
          className="w-12 h-12 shrink-0 rounded-2xl object-cover"
        />
        <div className="flex-1">
          <div className="font-extrabold text-[15px] flex flex-wrap items-center gap-2">
            {broker.agency} <VerifiedBadge status={broker.verified} />
          </div>
          <div className="text-[12.5px] text-ink/60 font-medium">
            {broker.name} · {broker.exp}y exp · {broker.cities.join(", ")}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[12.5px] font-semibold text-ink/70">
        {broker.reviews > 0 ? (
          <>★ {broker.rating} ({broker.reviews}) · {broker.responseTime}</>
        ) : (
          <>No verified reviews yet · {broker.responseTime}</>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {broker.areas.slice(0, 3).map((a) => (
          <span
            key={a}
            className="text-[11px] font-bold bg-paper border border-line px-2.5 py-1 rounded-full"
          >
            {a}
          </span>
        ))}
      </div>
      <div className="mt-3 text-[12px] text-ink/60 font-medium truncate">
        {broker.policy}
      </div>
    </Link>
  );
}
