"use client";

import { useState } from "react";
import { PHASE1_CITIES } from "@/lib/mock-data";

export default function BrokerOnboardPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", agency: "", phone: "", city: "Delhi", areas: "Dwarka" });
  const [msg, setMsg] = useState<string | null>(null);
  const [stepErr, setStepErr] = useState<string | null>(null);

  function next(from: number) {
    setStepErr(null);
    if (from === 1) {
      if (form.name.trim().length < 2) return setStepErr("Enter your full name (min 2 characters).");
      if (!/^\d{10}$/.test(form.phone.trim())) return setStepErr("Enter a valid 10-digit mobile number.");
    }
    if (from === 2) {
      if (form.agency.trim().length < 2) return setStepErr("Enter your agency name.");
      if (!form.areas.split(",").map((s) => s.trim()).filter(Boolean).length)
        return setStepErr("Add at least one area you serve.");
    }
    setStep(from + 1);
  }

  async function submit() {
    const res = await fetch("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, areas: form.areas.split(",").map((s) => s.trim()).filter(Boolean) }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Application ${data.broker.id} received — KYC review in ~24h. Badge appears only after human approval.` : (data.errors?.join(" ") ?? "Failed"));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="display font-black text-[36px]">List as a verified broker</h1>
      <p className="text-ink/60 text-[14px]">3 steps · Verification stays unbought — payment only unlocks tools & visibility.</p>
      <div className="mt-4 flex gap-2">{[1, 2, 3].map((i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-pine" : "bg-line"}`} />)}</div>
      <div className="mt-6 bg-cream border border-line rounded-3xl p-6 space-y-3">
        {step === 1 && (<>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full h-11 rounded-xl border border-line px-3" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile (OTP in Phase 2)" className="w-full h-11 rounded-xl border border-line px-3" />
          <button onClick={() => next(1)} className="w-full bg-ink text-white font-bold py-3 rounded-2xl">Continue →</button>
        </>)}
        {step === 2 && (<>
          <input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="Agency name" className="w-full h-11 rounded-xl border border-line px-3" />
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full h-11 rounded-xl border border-line px-3 font-semibold">
            {PHASE1_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} placeholder="Areas, comma separated" className="w-full h-11 rounded-xl border border-line px-3" />
          <div className="flex gap-2"><button onClick={() => setStep(1)} className="flex-1 border border-ink font-bold py-3 rounded-2xl">← Back</button><button onClick={() => next(2)} className="flex-1 bg-ink text-white font-bold py-3 rounded-2xl">Continue →</button></div>
        </>)}
        {stepErr && <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-[13px] font-semibold text-red-800">{stepErr}</div>}
        {step === 3 && (<>
          <p className="text-[13.5px]">Review: <b>{form.name || "—"}</b> · {form.agency || "—"} · {form.phone || "—"} · {form.city} · {form.areas}</p>
          <p className="text-[12.5px] text-ink/60">KYC docs (Aadhaar + agency proof) upload wires up in Phase 2 with UIDAI eKYC.</p>
          <div className="flex gap-2"><button onClick={() => setStep(2)} className="flex-1 border border-ink font-bold py-3 rounded-2xl">← Back</button><button onClick={submit} className="flex-1 bg-pine text-white font-bold py-3 rounded-2xl">Submit for review</button></div>
        </>)}
        {msg && <div className="bg-mist border border-pine/25 rounded-2xl p-3 text-[13px] font-semibold">{msg}</div>}
      </div>
    </main>
  );
}
