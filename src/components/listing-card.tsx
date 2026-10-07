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
      className="bg-cream border border-line rounded-3xl overflow-hidden card-hover block"
    >
      <div className="relative">
        <Photo
          src={listing.photos[0]}
          alt={listing.title}
          className="w-full h-52 object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <VerificationPill v={listing.verification} />
          <span className="bg-ink/80 text-white text-[11px] font-mono px-2.5 py-1 rounded-full">
            {listing.propId}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold text-[16px]">
              {listing.bhk} BHK {listing.type} · {listing.locality},{" "}
              {listing.city}
            </div>
            <div className="text-[12.5px] text-ink/60 font-medium">
              {listing.sector}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-[19px]">
              {inr(listing.rent)}
              <span className="text-[11px] font-semibold text-ink/50">/mo</span>
            </div>
            <div className="text-[11px] font-bold text-pine">
              Brokerage {listing.brok} · Visit{" "}
              {listing.visitFee === 0 ? "₹0" : `₹${listing.visitFee}`}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
          <FreshBadge listing={listing} />
          <span className="text-[12px] font-semibold text-ink/60">
            ★ {broker?.rating ?? "—"} · {broker?.agency}
          </span>
        </div>
      </div>
    </Link>
  );
}
