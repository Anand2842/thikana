import Link from "next/link";
import { fetchScopedLeads, fetchListings, fetchBrokers } from "@/lib/supabase/data";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="display font-black text-[36px]">My Enquiries</h1>
        <p className="text-ink/60 text-[14px] mt-2 font-medium">Sign in to see your enquiries. Brokers and seekers share one pipeline per enquiry.</p>
        <Link href="/auth?next=/dashboard" className="mt-6 inline-block bg-ink text-white font-extrabold text-[14px] px-8 py-3.5 rounded-2xl hover:bg-pine transition">
          Sign in →
        </Link>
      </main>
    );
  }
  const role = userRole(user);
  const [leads, listings, brokers] = await Promise.all([
    fetchScopedLeads({ userId: user.id, role, brokerId: userBrokerId(user) }),
    fetchListings(),
    fetchBrokers(),
  ]);
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const brokerById = new Map(brokers.map((b) => [b.id, b]));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="display font-black text-[36px]">My Enquiries</h1>
      <p className="text-ink/60 text-[14px] font-medium">
        {role === "admin"
          ? "Admin view — full pipeline. Moderation lives in the admin console."
          : role === "broker"
            ? "Leads assigned to your listings. Reviews unlock after a verified visit."
            : "Your enquiries, with the same pipeline status your broker sees."}
      </p>
      <div className="mt-6 space-y-3">
        {leads.map((l) => {
          const li = listingById.get(l.listingId);
          const b = brokerById.get(l.brokerId);
          return (
            <div key={l.id} className="bg-cream border border-line rounded-3xl p-5">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <b>{l.id} · {li ? `${li.bhk} BHK ${li.locality}, ${li.city}` : l.listingId} · {b?.agency}</b>
                <span className="text-[12px] font-extrabold bg-ink text-white px-3 py-1.5 rounded-full">{l.status}</span>
              </div>
              <p className="mt-2 text-[13.5px] text-ink/70">{l.msg}</p>
              <div className="mt-1 text-[12.5px] text-ink/55 font-semibold">Visit: {l.visit} · {l.date}</div>
            </div>
          );
        })}
        {leads.length === 0 && (
          <div className="bg-cream border border-line rounded-3xl p-8 text-center">
            <b>No enquiries yet.</b>
            <p className="text-[13px] text-ink/55 mt-1">Browse verified homes and contact a broker — it will show up here.</p>
            <Link href="/properties" className="mt-4 inline-block bg-ink text-white text-[13px] font-bold px-6 py-3 rounded-2xl">Browse homes</Link>
          </div>
        )}
      </div>
      {role === "admin" && (
        <p className="mt-6 text-[13px] text-ink/55">Moderation queues live in the <Link className="font-bold underline" href="/admin">admin console</Link>.</p>
      )}
    </main>
  );
}
