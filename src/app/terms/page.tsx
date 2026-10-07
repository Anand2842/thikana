import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms — Thikana" };
export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="eyebrow">THE FINE PRINT</div>
      <h1 className="display text-4xl font-black mt-2">Terms of use</h1>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink/80">
        <p>
          Thikana is a marketplace that connects tenants with independent
          brokers. Thikana is not a party to any rental agreement and does not
          act as an agent for either side.
        </p>
        <section>
          <h2 className="font-extrabold text-lg">1. Verification meaning</h2>
          <p className="mt-1">
            A “verified” badge means our team checked specific identity and
            business documents on a specific date, shown on the broker profile.
            It is not a guarantee of any property, transaction, or outcome.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">2. Listings and fees</h2>
          <p className="mt-1">
            Brokers must publish rent, deposit, brokerage, visit fee and any
            other mandatory charge before contacting a tenant. Never pay a token
            or advance before verifying the property in person and confirming
            the recipient’s identity.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">3. Fair use</h2>
          <p className="mt-1">
            Do not post false information, copy another broker’s photos, demand
            hidden charges, or misuse another user’s personal details. Accounts
            that breach these terms may be suspended after review.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">4. Reports and moderation</h2>
          <p className="mt-1">
            Reports are reviewed by our team. Repeated confirmed violations can
            flag listings and suspend brokers automatically. You can track your
            reports’ status on your dashboard.
          </p>
        </section>
        <section>
          <h2 className="font-extrabold text-lg">5. Liability</h2>
          <p className="mt-1">
            To the extent permitted by law, Thikana is not liable for losses
            arising from rental transactions arranged through the platform.
          </p>
        </section>
      </div>
    </main>
  );
}
