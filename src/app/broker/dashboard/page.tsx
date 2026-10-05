import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  fetchBrokers,
  fetchListings,
  fetchScopedLeads,
} from "@/lib/supabase/data";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import { inr, freshness } from "@/lib/trust";
import { VerificationPill } from "@/components/badges";
import ReconfirmButton from "@/components/reconfirm-button";
import LeadActions from "@/components/lead-actions";
export default async function BrokerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/broker/dashboard");
  const role = userRole(user),
    sp = await searchParams;
  if (role === "seeker")
    return (
      <main className="max-w-xl mx-auto px-4 py-16">
        <h1 className="display text-3xl font-black">
          Start your broker profile.
        </h1>
        <p className="mt-3">
          Apply with identity and business proof to access your inventory and
          lead inbox.
        </p>
        <Link href="/broker/onboard" className="button inline-block mt-6">
          Apply as a broker
        </Link>
      </main>
    );
  const brokerId =
    role === "admin" && typeof sp.broker === "string"
      ? sp.broker
      : userBrokerId(user);
  const brokers = await fetchBrokers();
  if (!brokerId)
    return (
      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="display text-3xl font-black">
          Choose a broker to preview.
        </h1>
        <div className="flex flex-wrap gap-3 mt-6">
          {brokers.map((b) => (
            <Link
              key={b.id}
              className="button secondary"
              href={`/broker/dashboard?broker=${b.id}`}
            >
              {b.agency}
            </Link>
          ))}
        </div>
      </main>
    );
  const broker = brokers.find((b) => b.id === brokerId);
  if (!broker) notFound();
  const [listings, leads] = await Promise.all([
    fetchListings(),
    fetchScopedLeads({ userId: user.id, role, brokerId }),
  ]);
  const mine = listings.filter((l) => l.brokerId === brokerId),
    inbox = leads.filter((l) => l.brokerId === brokerId);
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="eyebrow">BROKER DASHBOARD · {broker.agency}</div>
      <h1 className="display text-4xl font-black mt-2">
        Welcome, {broker.name.split(" ")[0]}.
      </h1>
      <p className="mt-3 text-ink/65">
        {mine.length} listings · {inbox.length} enquiries · Status:{" "}
        {broker.verified}
      </p>
      {broker.verified !== "verified" && (
        <div
          role="status"
          className="bg-mist border border-line rounded-3xl p-6 mt-6"
        >
          Your application is {broker.verified}. Listing creation unlocks after
          our team approves your documents.
          <Link className="block underline mt-3" href="/broker/onboard">
            Update application and documents →
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mt-6">
        {broker.verified === "verified" && (
          <Link className="button" href="/broker/listings/new">
            + New listing
          </Link>
        )}
        <Link className="button secondary" href={`/brokers/${broker.id}`}>
          Public profile
        </Link>
      </div>
      <h2 className="display text-2xl font-black mt-10">
        Inventory & freshness
      </h2>
      <div className="space-y-3 mt-4">
        {mine.map((l) => (
          <article
            key={l.id}
            className="bg-cream border border-line rounded-2xl p-5 flex flex-wrap items-center gap-3"
          >
            <VerificationPill v={l.verification} />
            <Link
              className="underline font-bold text-sm"
              href={`/properties/${l.id}`}
            >
              {l.title} · {inr(l.rent)}/mo
            </Link>
            <span className="text-xs text-ink/65">{freshness(l).label}</span>
            {["verified", "stale"].includes(l.verification) &&
              broker.verified === "verified" && (
                <ReconfirmButton listingId={l.id} propId={l.propId} />
              )}
          </article>
        ))}
        {!mine.length && (
          <p className="text-sm text-ink/65">No listings yet.</p>
        )}
      </div>
      <h2 className="display text-2xl font-black mt-10">Lead inbox</h2>
      <div className="space-y-3 mt-4">
        {inbox.map((l) => (
          <article
            key={l.id}
            className="bg-cream border border-line rounded-3xl p-5"
          >
            <b>{l.userName}</b>
            <p className="text-sm mt-2">
              {l.phone} · {l.status}
            </p>
            <p className="text-sm text-ink/65 mt-2">{l.msg}</p>
            <p className="text-sm mt-2">
              Visit:{" "}
              {l.visitAt
                ? new Date(l.visitAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }) + " IST"
                : "Not scheduled"}
            </p>
            <LeadActions lead={l} manage own={false} reviewed={false} />
          </article>
        ))}
        {!inbox.length && (
          <p className="text-sm text-ink/65">No enquiries yet.</p>
        )}
      </div>
    </main>
  );
}
