import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy — Thikana" };
export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="eyebrow">YOUR DATA</div>
      <h1 className="display text-4xl font-black mt-2">Privacy notice</h1>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink/80">
        <section>
          <h2 className="font-extrabold text-lg">What we collect</h2>
          <p className="mt-1">
            Account details (name, email, phone), enquiries and visit
            scheduling, saved homes, reviews, reports, and broker KYC documents
            (identity and business proof) submitted during onboarding.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">How we use it</h2>
          <p className="mt-1">
            To operate the marketplace: matching enquiries, scheduling visits,
            verifying brokers, moderating reports, and keeping listings fresh.
            KYC documents are visible only to our review team, never to other
            users.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">Sharing</h2>
          <p className="mt-1">
            When you contact a broker, your name, phone number and message are
            shared with that broker so the visit can happen. We do not sell
            personal data.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">Retention</h2>
          <p className="mt-1">
            Enquiry and visit records are kept for 3 years for dispute
            resolution, then anonymized. You can ask for correction or deletion
            of your data through the support page.
          </p>
        </section>
      </div>
    </main>
  );
}
