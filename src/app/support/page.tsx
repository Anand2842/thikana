import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Support — Thikana" };
export default function SupportPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="eyebrow">WE RESPOND</div>
      <h1 className="display text-4xl font-black mt-2">Support</h1>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink/80">
        <section className="bg-cream border border-line rounded-3xl p-6">
          <h2 className="font-extrabold text-lg">Something wrong with a listing or broker?</h2>
          <p className="mt-1">
            File a report from the property or broker page with details and,
            if possible, dates and screenshots described in text. Our team
            reviews reports. Repeated reports can trigger protective restrictions;
            an allegation is not a finding. Track progress under “My reports” on
            your dashboard.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">Stay safe</h2>
          <p className="mt-1">
            Never pay a token or advance before verifying the property in
            person. Confirm the recipient’s identity, collect receipts for every
            payment, and be cautious of prices far below the locality average.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">Data requests</h2>
          <p className="mt-1">
            Use <Link className="underline font-bold" href="/support/privacy">Privacy &amp; appeals</Link>
            {" "}for access, correction, deletion, consent withdrawal or an appeal.
            No broker/property report is required. The team targets acknowledgement
            within 24 hours and general resolution within seven days, applying shorter required deadlines.
          </p>
        </section>
        <p className="text-sm">
          Brokers: manage enquiries, visits and inventory from your{" "}
          <Link className="underline font-bold" href="/broker/dashboard">
            dashboard
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
