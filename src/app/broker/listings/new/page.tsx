"use client";

import { useState } from "react";
import { PHASE1_CITIES } from "@/lib/mock-data";

export default function NewListingPage() {
  const [form, setForm] = useState({ title: "2 BHK Apartment", city: "Delhi", locality: "Dwarka", rent: 24000, bhk: 2, brokerId: "B1" });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rent: Number(form.rent), bhk: Number(form.bhk) }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Listing ${data.listing.id} (${data.listing.propId}) created as pending — visible after admin approval.` : (data.errors?.join(" ") ?? "Failed"));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="display font-black text-[36px]">New listing</h1>
      <p className="text-ink/60 text-[14px]">Gets a permanent Property ID + photo-hash check. Starts as <b>pending</b>.</p>
      <form onSubmit={submit} className="mt-6 bg-cream border border-line rounded-3xl p-6 space-y-3">
        <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" className="w-full h-11 rounded-xl border border-line px-3" />
        <select value={form.city} onChange={(e) => set("city", e.target.value)} className="w-full h-11 rounded-xl border border-line px-3 font-semibold">
          {PHASE1_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.locality} onChange={(e) => set("locality", e.target.value)} placeholder="Locality" className="h-11 rounded-xl border border-line px-3" />
          <input value={form.brokerId} onChange={(e) => set("brokerId", e.target.value)} placeholder="Broker ID (e.g. B1)" className="h-11 rounded-xl border border-line px-3" />
          <input type="number" value={form.rent} onChange={(e) => set("rent", e.target.value)} placeholder="Rent" className="h-11 rounded-xl border border-line px-3" />
          <input type="number" value={form.bhk} onChange={(e) => set("bhk", e.target.value)} placeholder="BHK" className="h-11 rounded-xl border border-line px-3" />
        </div>
        <button className="w-full bg-ink text-white font-bold py-3 rounded-2xl">Submit listing</button>
        {msg && <div className="bg-mist border border-pine/25 rounded-2xl p-3 text-[13px] font-semibold">{msg}</div>}
      </form>
    </main>
  );
}
