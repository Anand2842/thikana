"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/lib/client-request";
import { inr } from "@/lib/trust";
export default function ContactBrokerForm({
  listingId,
  listingTitle,
  brokerAgency,
  brokerResponseTime,
  visitFee,
  visitFeeRefundable,
  signedIn,
}: {
  listingId: string;
  listingTitle: string;
  brokerAgency: string;
  brokerResponseTime: string;
  visitFee: number;
  visitFeeRefundable: boolean;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  // Preserve user work across refreshes and network failures; cleared only
  // on successful send. Restored after mount to avoid hydration mismatch.
  const empty = { name: "", phone: "", budget: "", moveIn: "", tenantType: "", msg: "" };
  const [draft, setDraft] = useState(empty);
  useEffect(() => {
    let live = true;
    // Deferred past mount: restores the draft without a synchronous
    // setState-in-effect and without hydration mismatch.
    queueMicrotask(() => {
      if (!live) return;
      try {
        const raw = sessionStorage.getItem(`enquiry:${listingId}`);
        if (raw) setDraft({ ...empty, ...JSON.parse(raw) });
      } catch {
        /* private mode — form simply starts empty */
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);
  function keep(next: Partial<typeof draft>) {
    setDraft((d) => {
      const merged = { ...d, ...next };
      try {
        sessionStorage.setItem(`enquiry:${listingId}`, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const budgetRaw = String(f.get("budget") ?? "").trim(),
      moveIn = String(f.get("moveIn") ?? "").trim(),
      tenantType = String(f.get("tenantType") ?? "").trim(),
      notes = String(f.get("msg") ?? "").trim();
    const parts: string[] = [];
    if (budgetRaw) {
      const n = Number(budgetRaw);
      parts.push(
        `Budget: ≤ ₹${Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-IN") : budgetRaw}`,
      );
    }
    if (moveIn) parts.push(`Move-in: ${moveIn}`);
    if (tenantType) parts.push(`Type: ${tenantType}`);
    if (notes) parts.push(`Notes: ${notes}`);
    try {
      await request("/api/leads", {
        listingId,
        name: f.get("name"),
        phone: f.get("phone"),
        msg: f.get("msg"),
        req: parts.join("; ").slice(0, 500),
        time: moveIn,
      });
      setDone(true);
      try {
        sessionStorage.removeItem(`enquiry:${listingId}`);
      } catch {
        /* ignore */
      }
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
        <ul className="mt-2 text-[13px] space-y-1">
          <li>Home: {listingTitle}</li>
          <li>
            Visit fee {visitFee === 0 ? "₹0" : `₹${visitFee}`} —{" "}
            {visitFee === 0 || visitFeeRefundable
              ? "nothing to pay upfront"
              : "due only after you verify the property in person"}
            .
          </li>
          <li>{brokerAgency} typically responds in {brokerResponseTime}.</li>
        </ul>
        <Link className="block underline mt-3" href="/dashboard">
          Manage enquiry & schedule a visit →
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
          value={draft.name}
          onChange={(e) => keep({ name: e.target.value })}
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
          value={draft.phone}
          onChange={(e) => keep({ phone: e.target.value })}
        />
      </label>
      <label>
        Monthly rent ceiling (₹, optional)
        <input
          name="budget"
          type="number"
          min={1}
          max={10000000}
          step={1}
          placeholder="e.g. 25000"
          value={draft.budget}
          onChange={(e) => keep({ budget: e.target.value })}
        />
      </label>
      <label>
        Move-in date (optional)
        <input
          name="moveIn"
          type="date"
          value={draft.moveIn}
          onChange={(e) => keep({ moveIn: e.target.value })}
        />
      </label>
      <label>
        Tenant type (optional)
        <select
          name="tenantType"
          value={draft.tenantType}
          onChange={(e) => keep({ tenantType: e.target.value })}
        >
          <option value="">Select…</option>
          <option value="Family">Family</option>
          <option value="Student">Student</option>
          <option value="Working professional">Working professional</option>
        </select>
      </label>
      <label>
        Your questions
        <textarea
          name="msg"
          maxLength={2000}
          rows={3}
          placeholder="Move-in date, family size, questions…"
          value={draft.msg}
          onChange={(e) => keep({ msg: e.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button className="button w-full" disabled={busy}>
        {busy ? "Sending…" : "Send enquiry"}
      </button>
      <p className="text-xs text-ink/65">
        {visitFee === 0
          ? "No visit fee. Never pay a token before a visit."
          : `Visit fee ${inr(visitFee)} due only after you verify the property in person. Never pay a token before a visit.`}{" "}
        Report advance-fee demands.
      </p>
    </form>
  );
}
