"use client";
import Link from "next/link";
import { useState } from "react";
import { request } from "@/lib/client-request";
import { inr } from "@/lib/trust";
export default function ContactBrokerForm({
  listingId,
  brokerAgency,
  visitFee,
  signedIn,
}: {
  listingId: string;
  brokerAgency: string;
  visitFee: number;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await request("/api/leads", {
        listingId,
        name: f.get("name"),
        phone: f.get("phone"),
        msg: f.get("msg"),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div
        role="status"
        className="bg-mist border border-pine/25 rounded-3xl p-5"
      >
        <b>Enquiry sent to {brokerAgency}.</b>
        <Link className="block underline mt-3" href="/dashboard">
          View enquiry & schedule a visit →
        </Link>
      </div>
    );
  if (!signedIn)
    return (
      <Link
        className="button block"
        href={`/auth?next=/properties/${listingId}`}
      >
        Sign in to contact {brokerAgency}
      </Link>
    );
  return (
    <form
      onSubmit={submit}
      className="bg-cream border border-line rounded-3xl p-5 space-y-3"
    >
      <b>Contact {brokerAgency}</b>
      <label>
        Your name
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        Mobile number
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          pattern="[0-9]{10}"
          maxLength={10}
        />
      </label>
      <label>
        Your questions
        <textarea
          name="msg"
          maxLength={2000}
          rows={3}
          placeholder="Move-in date, family size, questions…"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button className="button w-full" disabled={busy}>
        {busy ? "Sending…" : `Send enquiry · Visit ${inr(visitFee)}`}
      </button>
      <p className="text-xs text-ink/65">
        Never pay a token before a visit. Report advance-fee demands.
      </p>
    </form>
  );
}
