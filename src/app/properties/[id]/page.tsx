import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchListingVisible,
  fetchBroker,
  fetchSameProp,
  fetchReviews,
  fetchSavedIds,
  fetchBrokers,
} from "@/lib/supabase/data";
import {
  absoluteUrl,
  listingDescription,
  listingJsonLd,
  listingTitle,
} from "@/lib/seo";
import {
  inr,
  freshness,
  isActive,
  brokerageAmount,
  moveInTotal,
} from "@/lib/trust";
import { FreshBadge, VerificationPill } from "@/components/badges";
import { Gallery } from "@/components/photo";
import Photo from "@/components/photo";
import PropertyActions from "@/components/property-actions";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import ContactBrokerForm from "@/components/contact-broker-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Public catalog only: crawlers never get pending/review content.
  const listing = await fetchListingVisible(id, { role: "seeker", brokerId: null });
  if (!listing || listing.verification !== "verified")
    return { robots: { index: false, follow: false } };
  const broker = await fetchBroker(listing.brokerId);
  const brokerName = broker?.agency ?? "verified broker";
  const title = listingTitle(listing);
  const description = listingDescription(listing, brokerName);
  const url = absoluteUrl(`/properties/${listing.id}`);
  const image = listing.photos.find((p) => p.startsWith("https://")) ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  // Public catalog first; admins and the owning broker can also preview
  // listings that are still pending moderation.
  const listing = await fetchListingVisible(id, {
    role: userRole(user),
    brokerId: userBrokerId(user),
  });
  if (!listing) notFound();
  const broker = await fetchBroker(listing.brokerId);
  const brokers = await fetchBrokers();
  const group = (await fetchSameProp(listing.propId)).filter(
    (l) =>
      isActive(l) &&
      brokers.find((b) => b.id === l.brokerId)?.verified === "verified",
  );
  const saved = user ? (await fetchSavedIds(user.id)).includes(id) : false;
  const available = isActive(listing) && broker?.verified === "verified";
  const brokerReviewCount = (await fetchReviews(listing.brokerId)).length;
  const f = freshness(listing);
  const brokerById = new Map(brokers.map((b) => [b.id, b]));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            listingJsonLd(
              listing,
              broker
                ? { id: broker.id, agency: broker.agency, rating: broker.rating, reviews: broker.reviews }
                : null,
              brokerReviewCount,
            ),
          ),
        }}
      />
      <Link
        href="/properties"
        className="text-[13px] font-bold text-ink/60 hover:text-ink"
      >
        ← Back to results
      </Link>
      <div className="mt-4 grid lg:grid-cols-[1.1fr_.9fr] gap-8">
        <div>
          <Gallery photos={listing.photos} title={listing.title} />
          <div className="mt-6 bg-cream border border-line rounded-3xl p-6">
            <b>About this home</b>
            <p className="mt-2 text-[14px] text-ink/75 leading-relaxed">
              {listing.desc}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {listing.amenities.map((a) => (
                <span
                  key={a}
                  className="text-[12px] font-bold bg-paper border border-line px-3 py-1.5 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
          {group.length > 1 && (
            <div className="mt-4 bg-cream border-2 border-gold/60 rounded-3xl p-6">
              <b className="text-[14px]">
                ◈ Same property — {new Set(group.map((l) => l.brokerId)).size}{" "}
                verified brokers{" "}
                <span className="font-mono text-[12px] text-ink/50">
                  {listing.propId}
                </span>
              </b>
              <div className="mt-3 space-y-2">
                {group.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap gap-3 items-center justify-between bg-paper border border-line rounded-2xl p-3 text-[13px]"
                  >
                    <span>
                      <b>{inr(g.rent)}/mo</b> · {g.brok} · Visit{" "}
                      {g.visitFee === 0 ? "₹0" : `₹${g.visitFee}`} ·{" "}
                      {brokerById.get(g.brokerId)?.agency ?? "Verified broker"}
                    </span>
                    {g.id === listing.id ? (
                      <span className="text-[10px] font-extrabold bg-pine text-white px-2 py-1 rounded-full">
                        VIEWING
                      </span>
                    ) : (
                      <Link
                        href={`/properties/${g.id}`}
                        className="font-bold border border-ink px-3 py-1.5 rounded-full"
                      >
                        View
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-cream border border-line rounded-3xl p-6">
            <div className="flex flex-wrap gap-2">
              <VerificationPill v={listing.verification} />
              <FreshBadge listing={listing} />
            </div>
            <h1 className="display font-black text-[30px] mt-3">
              {listing.bhk} BHK {listing.type} · {listing.locality},{" "}
              {listing.city}
            </h1>
            <div className="text-[13.5px] text-ink/60 font-medium">
              {listing.sector} · {listing.area} sq.ft · {listing.floor}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px] font-semibold">
              <div className="bg-paper border border-line rounded-2xl p-3">
                Rent<b className="block text-[16px]">{inr(listing.rent)}/mo</b>
              </div>
              <div className="bg-paper border border-line rounded-2xl p-3">
                Deposit
                <b className="block text-[16px]">{inr(listing.deposit)}</b>
              </div>
              <div className="bg-paper border border-line rounded-2xl p-3">
                Brokerage
                <b className="block text-pine">
                  {inr(brokerageAmount(listing))} ({listing.brokDays} days)
                </b>
              </div>
              <div className="bg-paper border border-line rounded-2xl p-3">
                Visit fee
                <b className="block">
                  {listing.visitFee === 0 ? "₹0" : `₹${listing.visitFee}`}
                </b>
                {listing.visitFee > 0 && (
                  <span className="text-[11px] font-semibold text-ink/60">
                    {listing.visitFeeRefundable
                      ? "Refundable"
                      : "Non-refundable — pay only after verifying the property in person"}
                  </span>
                )}
              </div>
              <div className="bg-paper border border-line rounded-2xl p-3">
                Other fees<b className="block">{inr(listing.otherFee)}</b>
                {listing.otherFeeNote && (
                  <span className="text-[11px] font-semibold text-ink/60">
                    {listing.otherFeeNote}
                  </span>
                )}
              </div>
              <div className="bg-ink text-white rounded-2xl p-3">
                Estimated move-in total
                <b className="block">{inr(moveInTotal(listing))}</b>
              </div>
            </div>
            <p className="mt-3 text-sm">
              {listing.furnishing} · Available: {listing.avail}
            </p>
            <p className="mt-1 text-xs text-ink/65">
              Owner authorization:{" "}
              {!listing.ownerRelationship
                ? "not provided"
                : listing.ownerRelationship === "owner"
                  ? "Listed by the owner-broker"
                  : listing.ownerRelationship === "subagent"
                    ? "Marketed by a sub-agent for the owner"
                    : "Marketed by an authorized agent of the owner"}
            </p>
            <p className="mt-2 text-xs text-ink/65">
              Total includes first month’s rent, refundable deposit, brokerage,
              visit and other disclosed fees.
            </p>
            <div className="mt-3 text-[12.5px] text-ink/60 font-mono">
              Property ID {listing.propId} · {f.label} · {listing.views} views
            </div>
            {listing.flags && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-[12.5px] font-semibold text-red-800">
                ⚑ {listing.flags.join(" · ")}
              </div>
            )}
          </div>
          {broker && (
            <div className="bg-ink text-white rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <Photo
                  src={broker.photo}
                  alt=""
                  className="w-12 h-12 rounded-2xl object-cover"
                />
                <div>
                  <b>{broker.agency}</b>
                  <div className="text-[12.5px] text-white/65">
                    ★ {broker.rating} ({broker.reviews}) · {broker.responseTime}{" "}
                    response · {broker.tenure}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[12.5px] text-white/70">
                {broker.policy}
              </div>
              <Link
                href={`/brokers/${broker.id}`}
                className="mt-4 block text-center border border-white/25 font-bold py-2.5 rounded-2xl text-[13.5px]"
              >
                View broker profile →
              </Link>
            </div>
          )}
          {available ? (
            <ContactBrokerForm
              listingId={listing.id}
              brokerAgency={broker?.agency ?? "broker"}
              visitFee={listing.visitFee}
              signedIn={!!user}
            />
          ) : (
            <div
              role="status"
              className="bg-red-50 border border-red-200 rounded-3xl p-5"
            >
              This home is {listing.verification}. Enquiries are paused until
              availability and broker approval are confirmed.
            </div>
          )}
          <PropertyActions id={id} signedIn={!!user} initialSaved={saved} />
          <div className="text-[12px] text-ink/55 font-medium">
            <Link
              className="underline"
              href={`/brokers/${listing.brokerId}#reviews`}
            >
              Reviews for this broker: {brokerReviewCount} verified-visit
              reviews on profile
            </Link>
            .
          </div>
        </div>
      </div>
    </main>
  );
}
