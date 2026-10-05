import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchScopedLeads,
  fetchListings,
  fetchBrokers,
  fetchSavedIds,
  fetchReviewedIds,
} from "@/lib/supabase/data";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import ListingCard from "@/components/listing-card";
import LeadActions from "@/components/lead-actions";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/dashboard");
  const role = userRole(user),
    brokerId = userBrokerId(user);
  const [leads, listings, brokers, saved, reviewed] = await Promise.all([
    fetchScopedLeads({ userId: user.id, role, brokerId }),
    fetchListings(),
    fetchBrokers(),
    fetchSavedIds(user.id),
    fetchReviewedIds(user.id),
  ]);
  const byListing = new Map(listings.map((l) => [l.id, l])),
    byBroker = new Map(brokers.map((b) => [b.id, b]));
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="eyebrow">YOUR NEXT ADDRESS</div>
      <h1 className="display text-4xl font-black">My homes & enquiries</h1>
      <p className="mt-3 text-ink/65">
        Saved homes, shared enquiry status and visits — all in one place.
      </p>
      <h2 className="display text-2xl font-black mt-8">
        Enquiries ({leads.length})
      </h2>
      <div className="space-y-4 mt-4">
        {leads.map((l) => (
          <article
            key={l.id}
            className="bg-cream border border-line rounded-3xl p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <Link
                className="font-bold underline"
                href={`/properties/${l.listingId}`}
              >
                {byListing.get(l.listingId)?.title ?? l.listingId} ·{" "}
                {byBroker.get(l.brokerId)?.agency}
              </Link>
              <span className="text-xs font-bold bg-ink text-white px-3 py-2 rounded-full">
                {l.status}
              </span>
            </div>
            <p className="text-sm mt-3">{l.msg}</p>
            <p className="text-xs text-ink/65 mt-2">
              Visit:{" "}
              {l.visitAt
                ? new Date(l.visitAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }) + " IST"
                : "Not scheduled"}{" "}
              · Enquired {l.date}
            </p>
            <LeadActions
              lead={l}
              manage={role === "admin" || l.brokerId === brokerId}
              own={l.ownerId === user.id}
              reviewed={reviewed.includes(l.id)}
            />
          </article>
        ))}
        {!leads.length && (
          <div className="bg-cream border border-line rounded-3xl p-8">
            <b>No enquiries yet.</b>
            <p className="text-sm mt-2">
              Contact a broker from a property page to start.
            </p>
            <Link className="button inline-block mt-4" href="/properties">
              Browse homes
            </Link>
          </div>
        )}
      </div>
      <h2 className="display text-2xl font-black mt-10">
        Saved homes ({saved.length})
      </h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings
          .filter((l) => saved.includes(l.id))
          .map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              broker={byBroker.get(l.brokerId)}
            />
          ))}
      </div>
      {!saved.length && (
        <p className="text-sm mt-4 text-ink/65">
          Use “Save home” on a property page to build your shortlist.
        </p>
      )}
    </main>
  );
}
