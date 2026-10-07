import Link from "next/link";
import { type Broker, type Listing } from "@/lib/mock-data";
import { inr } from "@/lib/trust";
import Photo from "./photo";
import { FreshBadge, VerificationPill } from "./badges";

export default function ListingCard({
  listing,
  broker,
}: {
  listing: Listing;
  broker?: Broker;
}) {
  return (
    <Link
      href={`/properties/${listing.id}`}
      className="group block"
      aria-label={`${listing.bhk} BHK ${listing.type} in ${listing.locality}, ${listing.city}, ${inr(listing.rent)} per month`}
    >
      <div className="relative overflow-hidden rounded-2xl">
        <Photo
          src={listing.photos[0]}
          alt=""
          className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute top-3 left-3">
          <VerificationPill v={listing.verification} />
        </div>
      </div>
      <div className="pt-3 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="font-bold text-[15px] leading-snug">
            {listing.locality}, {listing.city}
          </div>
          <div className="text-[13px] font-semibold text-ink/70 shrink-0">
            ★ {broker?.rating ?? "—"}
          </div>
        </div>
        <div className="text-[13px] text-ink/55 mt-0.5">
          {listing.bhk} BHK {listing.type} · {broker?.agency}
        </div>
        <div className="mt-1 text-[15px]">
          <b>{inr(listing.rent)}</b>
          <span className="font-medium text-ink/60">/mo</span>
          <span className="text-[12px] font-semibold text-pine ml-2">
            + {listing.brokDays}d brokerage
          </span>
        </div>
        <div className="mt-1.5">
          <FreshBadge listing={listing} />
        </div>
      </div>
    </Link>
  );
}
