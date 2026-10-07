import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssurance, getSessionUser, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { PrivacyRequestReview } from "@/components/privacy-request-form";
export const metadata: Metadata = { title: "Privacy request queue — Thikana", robots: { index: false, follow: false } };
export default async function PrivacyQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/admin/privacy-requests");
  if (userRole(user) !== "admin") redirect("/dashboard");
  if ((await getAssurance()).current !== "aal2") redirect("/admin/mfa");
  const sp = await searchParams, status = ["Open", "Reviewing", "Closed"].includes(String(sp.status)) ? String(sp.status) : "Open";
  const page = Math.max(1, Math.min(50000, Math.floor(Number(sp.page) || 1))), size = 20;
  const { data, count, error } = await createServiceClient().from("privacy_requests").select("*", { count: "exact" })
    .eq("status", status).order("created_at", { ascending: true }).range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
    <div className="eyebrow">TRUST OPERATIONS · PRIVATE REQUESTS</div>
    <h1 className="display text-4xl font-black mt-3">Privacy &amp; appeals queue</h1>
    <p className="mt-4 text-ink/65">Verify identity and authority before a disclosure, correction or deletion. A case reference or contact email alone is not proof. Keep privacy requests separate from fraud-report counts.</p>
    <p className="mt-3 text-sm text-ink/65">Guest requests have no account tracker. Send their acknowledgement and outcome through the authorised support email channel. Recording a response here does not send an email.</p>
    <nav className="flex flex-wrap gap-4 mt-4 text-sm font-bold" aria-label="Staff links"><Link className="underline" href="/admin">Moderation</Link><Link className="underline" href="/admin/policy">Staff policy</Link><Link className="underline" href="/privacy">Public notice</Link></nav>
    <nav className="flex gap-4 mt-6 text-sm font-bold" aria-label="Request status">{["Open", "Reviewing", "Closed"].map(s => <Link key={s} aria-current={s === status ? "page" : undefined} className={s === status ? "text-pine underline" : "underline"} href={`?status=${s}`}>{s}</Link>)}</nav>
    <p className="mt-3 text-xs text-ink/55">{count ?? 0} {status.toLowerCase()} requests · Page {page}</p>
    <div className="space-y-4 mt-5">{data?.map(r => <article key={r.id} className="bg-cream border border-line rounded-3xl p-5 sm:p-7">
      <h2 className="display text-xl font-bold">{r.kind}</h2>
      <p className="text-sm mt-2 break-all">{r.contact_email} · {r.owner_id ? "Submitted from a signed-in account" : "Guest request — identity not verified"}</p>
      <p className="text-xs text-ink/55 mt-1 break-all">{r.id} · {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
      <p className="mt-4 whitespace-pre-wrap break-words">{r.details}</p>
      {r.response && <div className="mt-3 border-l-2 border-pine pl-3 text-sm"><b>Recorded response:</b><p className="whitespace-pre-wrap break-words">{r.response}</p></div>}
      <PrivacyRequestReview id={r.id} status={r.status} />
    </article>)}</div>
    {!data?.length && <p className="mt-5 text-ink/65">No {status.toLowerCase()} requests.</p>}
    <nav aria-label="Queue pages" className="flex gap-4 mt-5 text-sm font-bold">{page > 1 && <Link className="underline" href={`?status=${status}&page=${page - 1}`}>Previous</Link>}{page * size < (count ?? 0) && <Link className="underline" href={`?status=${status}&page=${page + 1}`}>Next</Link>}</nav>
  </div>;
}
