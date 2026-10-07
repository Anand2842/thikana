import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import PrivacyRequestForm from "@/components/privacy-request-form";
export const metadata: Metadata = { title: "Privacy & appeals — Thikana", robots: { index: false, follow: false } };
export default async function PrivacySupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser(), sp = await searchParams;
  const page = Math.max(1, Math.min(50000, Math.floor(Number(sp.page) || 1))), size = 20;
  const result = user ? await createServiceClient().from("privacy_requests")
    .select("id,kind,status,response,created_at,updated_at", { count: "exact" }).eq("owner_id", user.id)
    .order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1) : null;
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <div className="eyebrow">YOUR INFORMATION · YOUR SAY</div>
    <h1 className="display text-4xl font-black mt-3">Privacy &amp; appeals</h1>
    <p className="mt-4 text-ink/65 leading-relaxed">Ask for access, correction, deletion, consent withdrawal or review of a moderation decision. This channel is separate from listing/broker complaints. Our team targets acknowledgement within 24 hours and general resolution within seven days, applying shorter required deadlines.</p>
    {!user && <p className="mt-3 text-sm"><Link className="underline font-bold" href="/auth?next=/support/privacy">Sign in to track your request</Link>, or submit below without an account. Keep the reference; the team uses your contact email for guest requests.</p>}
    <p className="mt-3 mb-6 text-sm">See the <Link className="underline" href="/privacy">Privacy Notice</Link> and <Link className="underline" href="/terms">Terms of use</Link> for purposes, retention and appeal rights.</p>
    <PrivacyRequestForm email={user?.email} />
    {user && <section className="mt-10">
      <h2 className="display text-2xl font-black">Your requests</h2>
      {result?.error ? <p role="alert" className="mt-3 text-red-700">Your requests could not be loaded. Refresh to try again.</p> : <>
        {result?.data?.length === 0 && <p className="mt-3 text-ink/65">No requests yet. New requests and staff responses will appear here.</p>}
        <div className="mt-4 space-y-3">{result?.data?.map(r => <article key={r.id} className="border border-line rounded-2xl p-5">
          <div className="flex justify-between gap-3"><h3 className="font-bold">{r.kind}</h3><span className="text-sm font-bold">{r.status}</span></div>
          <p className="text-xs text-ink/55 mt-2 break-all">{r.id} · {new Date(r.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          {r.response ? <p className="mt-3 whitespace-pre-wrap break-words">{r.response}</p> : <p className="mt-3 text-sm text-ink/65">Waiting for the review team’s acknowledgement.</p>}
        </article>)}</div>
        <nav aria-label="Request pages" className="flex gap-4 mt-4 text-sm font-bold">{page > 1 && <Link className="underline" href={`?page=${page - 1}`}>Previous</Link>}{page * size < (result?.count ?? 0) && <Link className="underline" href={`?page=${page + 1}`}>Next</Link>}</nav>
      </>}
    </section>}
  </main>;
}
