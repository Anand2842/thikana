import Link from "next/link";
import type { ReactNode } from "react";
import { POLICY_DATE, POLICY_VERSION } from "@/lib/policies";
export default function PolicyPage({ title, intro, audience, sections }: { title: string; intro: string; audience: string; sections: { title: string; body: ReactNode }[] }) {
  return <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
    <div className="eyebrow">THIKANA · {audience}</div>
    <h1 className="display text-4xl sm:text-5xl font-black mt-3 max-w-3xl">{title}</h1>
    <p className="mt-4 text-lg text-ink/65 max-w-2xl leading-relaxed">{intro}</p>
    <p className="mt-4 text-xs text-ink/55">Effective {POLICY_DATE} · Version {POLICY_VERSION}</p>
    <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold mt-6 border-y border-line py-4">
      <Link className="underline" href="/terms">Terms of use</Link><Link className="underline" href="/broker-agreement">Broker Agreement</Link><Link className="underline" href="/privacy">Privacy Notice</Link><Link className="underline" href="/support/privacy">Privacy & appeals</Link>
    </nav>
    <div className="mt-8 grid lg:grid-cols-[220px_1fr] gap-8 lg:gap-12">
      <nav aria-label="On this page" className="text-sm lg:sticky lg:top-24 self-start"><p className="font-bold mb-3">On this page</p><ul className="space-y-2 text-ink/65">{sections.map((s, i) => <li key={s.title}><a className="hover:text-pine underline underline-offset-4" href={`#policy-${i}`}>{s.title}</a></li>)}</ul></nav>
      <div className="max-w-3xl space-y-8 text-[15px] leading-relaxed text-ink/80">{sections.map((s, i) => <section key={s.title} id={`policy-${i}`} className="scroll-mt-24 border-b border-line pb-8"><h2 className="display text-2xl font-bold text-ink mb-3">{s.title}</h2><div className="space-y-3 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">{s.body}</div></section>)}</div>
    </div>
  </main>;
}
export function OperatorDetails() {
  const entity = process.env.LEGAL_ENTITY_NAME?.trim(), address = process.env.LEGAL_POSTAL_ADDRESS?.trim(), email = process.env.LEGAL_CONTACT_EMAIL?.trim(), officer = process.env.GRIEVANCE_OFFICER_NAME?.trim(), grievanceEmail = process.env.GRIEVANCE_CONTACT_EMAIL?.trim(), regions = process.env.DATA_HOSTING_LOCATIONS?.trim();
  return <div className="bg-cream border border-line rounded-2xl p-5 space-y-2 text-sm">
    <p><b>Marketplace:</b> Thikana · Delhi, Gurugram, Noida, Greater Noida and Ghaziabad.</p>
    <p><b>Operator:</b> {entity || "Registered operator details are pending before public launch."}</p>
    <p><b>Postal address:</b> {address || "Pending publication before public launch."}</p>
    <p><b>Contact:</b> {email ? <a href={`mailto:${email}`}>{email}</a> : <Link href="/support/privacy">Use the privacy and appeals form</Link>}</p>
    <p><b>Grievance officer:</b> {officer || "A named officer must be appointed before public launch."}{grievanceEmail && <> · <a href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a></>}</p>
    <p><b>Hosting locations:</b> {regions || "Deployment locations have not yet been published. We do not promise India-only hosting."}</p>
    {(!entity || !address || !email || !officer || !grievanceEmail || !regions) && <p className="text-amber-800 font-semibold">Review edition for the testing workspace. Operator, contact and deployment details must be completed before public launch.</p>}
  </div>;
}
