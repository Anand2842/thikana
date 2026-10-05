import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchListing, fetchBroker, fetchSameProp, fetchReviews } from "@/lib/supabase/data";
import { inr, freshness } from "@/lib/trust";
import { FreshBadge, VerificationPill } from "@/components/badges";
import ContactBrokerForm from "@/components/contact-broker-form";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await fetchListing(id);
  if (!listing) notFound();
  const broker = await fetchBroker(listing.brokerId);
  const group = await fetchSameProp(listing.propId);
  const brokerReviewCount = (await fetchReviews(listing.brokerId)).length;
  const f = freshness(listing);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/properties" className="text-[13px] font-bold text-ink/60 hover:text-ink">← Back to results</Link>
      <div className="mt-4 grid lg:grid-cols-[1.1fr_.9fr] gap-8">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-[380px] object-cover rounded-3xl border border-line" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {listing.photos.slice(1).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={p} alt="" className="w-full h-28 object-cover rounded-2xl border border-line" />
            ))}
          </div>
          <div className="mt-6 bg-cream border border-line rounded-3xl p-6">
            <b>About this home</b>
            <p className="mt-2 text-[14px] text-ink/75 leading-relaxed">{listing.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {listing.amenities.map((a) => (
                <span key={a} className="text-[12px] font-bold bg-paper border border-line px-3 py-1.5 rounded-full">{a}</span>
              ))}
            </div>
          </div>
          {group.length > 1 && (
            <div className="mt-4 bg-cream border-2 border-gold/60 rounded-3xl p-6">
              <b className="text-[14px]">◈ Same property — {group.length} verified brokers <span className="font-mono text-[12px] text-ink/50">{listing.propId}</span></b>
              <div className="mt-3 space-y-2">
                {group.map((g) => (
                  <div key={g.id} className="flex items-center justify-between bg-paper border border-line rounded-2xl p-3 text-[13px]">
                    <span><b>{inr(g.rent)}/mo</b> · {g.brok} · Visit {g.visitFee === 0 ? "₹0" : `₹${g.visitFee}`}</span>
                    {g.id === listing.id ? <span className="text-[10px] font-extrabold bg-pine text-white px-2 py-1 rounded-full">VIEWING</span> : <Link href={`/properties/${g.id}`} className="font-bold border border-ink px-3 py-1.5 rounded-full">View</Link>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-cream border border-line rounded-3xl p-6">
            <div className="flex gap-2"><VerificationPill v={listing.verification} /><FreshBadge listing={listing} /></div>
            <h1 className="display font-black text-[30px] mt-3">{listing.bhk} BHK {listing.type} · {listing.locality}, {listing.city}</h1>
            <div className="text-[13.5px] text-ink/60 font-medium">{listing.sector} · {listing.area} sq.ft · {listing.floor}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px] font-semibold">
              <div className="bg-paper border border-line rounded-2xl p-3">Rent<b className="block text-[16px]">{inr(listing.rent)}/mo</b></div>
              <div className="bg-paper border border-line rounded-2xl p-3">Deposit<b className="block text-[16px]">{inr(listing.deposit)}</b></div>
              <div className="bg-paper border border-line rounded-2xl p-3">Brokerage<b className="block text-pine">{listing.brok}</b></div>
              <div className="bg-paper border border-line rounded-2xl p-3">Visit fee<b className="block">{listing.visitFee === 0 ? "₹0" : `₹${listing.visitFee}`}</b></div>
            </div>
            <div className="mt-3 text-[12.5px] text-ink/60 font-mono">Property ID {listing.propId} · {f.label} · {listing.views} views</div>
            {listing.flags && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-[12.5px] font-semibold text-red-800">
                ⚑ {listing.flags.join(" · ")}
              </div>
            )}
          </div>
          {broker && (
            <div className="bg-ink text-white rounded-3xl p-6">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={broker.photo} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                <div><b>{broker.agency}</b><div className="text-[12.5px] text-white/65">★ {broker.rating} ({broker.reviews}) · {broker.responseTime} response</div></div>
              </div>
              <div className="mt-3 text-[12.5px] text-white/70">{broker.policy}</div>
              <Link href={`/brokers/${broker.id}`} className="mt-4 block text-center border border-white/25 font-bold py-2.5 rounded-2xl text-[13.5px]">View broker profile →</Link>
            </div>
          )}
          <ContactBrokerForm listingId={listing.id} brokerAgency={broker?.agency ?? "broker"} />
          <div className="text-[12px] text-ink/55 font-medium">
            Reviews for this broker: {brokerReviewCount} verified-visit reviews on profile.
          </div>
        </div>
      </div>
    </main>
  );
}
