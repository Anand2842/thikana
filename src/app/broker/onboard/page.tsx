"use client";
import { useState } from "react";
import Link from "next/link";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { request } from "@/lib/client-request";
import { createClient } from "@/lib/supabase/client";
export default function BrokerOnboardPage() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const paths: string[] = [];
      for (const key of ["identity", "business"]) {
        const upload = new FormData();
        upload.set("file", f.get(key)!);
        upload.set("kind", "proof");
        paths.push((await request("/api/uploads", upload)).path);
      }
      await request("/api/brokers", {
        name: f.get("name"),
        agency: f.get("agency"),
        phone: f.get("phone"),
        city: f.get("city"),
        areas: String(f.get("areas"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        policy: f.get("policy"),
        identityPath: paths[0],
        businessPath: paths[1],
      });
      const { error } = await createClient().auth.refreshSession();
      if (error) throw error;
      // The role changed; discard pages prefetched with the old session.
      window.location.assign("/broker/dashboard");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="eyebrow">FOR LOCAL BROKERS</div>
      <h1 className="display text-4xl font-black">
        Build trust before the visit.
      </h1>
      <p className="mt-3 text-ink/65">
        Apply for a broker profile. Our team checks your identity and business
        documents before granting verification.
      </p>
      <form
        onSubmit={submit}
        className="mt-6 bg-cream border border-line rounded-3xl p-5 sm:p-8 grid sm:grid-cols-2 gap-4"
      >
        <label>
          Full name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <label>
          Mobile number
          <input
            name="phone"
            required
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
          />
        </label>
        <label>
          Agency name
          <input name="agency" required minLength={2} maxLength={100} />
        </label>
        <label>
          City
          <select name="city">
            {PHASE1_CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          Areas served, comma separated
          <input
            name="areas"
            required
            maxLength={1000}
            placeholder="Dwarka, Janakpuri"
          />
        </label>
        <label className="sm:col-span-2">
          Public brokerage policy
          <textarea
            name="policy"
            required
            minLength={10}
            maxLength={1000}
            placeholder="15 days brokerage, no visit fee, all charges disclosed"
            rows={3}
          />
        </label>
        <label>
          Masked identity proof
          <input
            name="identity"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
          />
        </label>
        <label>
          Business / agency proof
          <input
            name="business"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
          />
        </label>
        <p className="sm:col-span-2 text-xs text-ink/65">
          JPEG, PNG or PDF, up to 5 MB each. Mask sensitive ID numbers before
          uploading. Documents are private and available only to our review
          team.
        </p>
        <button className="button sm:col-span-2" disabled={busy}>
          {busy ? "Uploading & submitting…" : "Submit application"}
        </button>
        {message && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {message}
          </p>
        )}
      </form>
      <Link className="block mt-6 underline text-sm" href="/broker/dashboard">
        Already applied? View application status →
      </Link>
    </main>
  );
}
