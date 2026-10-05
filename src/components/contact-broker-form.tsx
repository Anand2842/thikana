"use client";

import { useState } from "react";

export default function ContactBrokerForm({ listingId, brokerAgency }: { listingId: string; brokerAgency: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, listingId, msg }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.errors?.join(" ") ?? "Could not send enquiry.");
      return;
    }
    setDone(`Enquiry ${data.lead.id} sent to ${brokerAgency}. Typical response ~2h. No advance payment needed.`);
  }

  if (done) return <div className="bg-mist border border-pine/25 rounded-2xl p-4 text-[13.5px] font-semibold text-pinedark">{done}</div>;

  return (
    <form onSubmit={submit} className="bg-cream border border-line rounded-3xl p-5 space-y-3">
      <b className="text-[15px]">Contact {brokerAgency}</b>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full h-11 rounded-xl border border-line bg-white px-3 text-[14px]" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className="w-full h-11 rounded-xl border border-line bg-white px-3 text-[14px]" />
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Move-in date, family size, questions…" rows={3} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]" />
      {error && <div className="text-[13px] font-semibold text-red-700">{error}</div>}
      <button className="w-full bg-ink text-white font-extrabold py-3 rounded-2xl hover:bg-pine transition text-[14px]">
        Send enquiry · Visit ₹0
      </button>
      <p className="text-[11.5px] text-ink/55 font-medium">Never pay token before a visit. Report advance-fee demands.</p>
    </form>
  );
}
