"use client";

import { useState } from "react";

export default function CityRequestForm() {
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState("seeker");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/city-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, name, phone, userType }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Noted! We'll open ${city.trim()} when demand stacks up. (${data.request.id})` : (data.errors?.join(" ") ?? "Could not save."));
    if (res.ok) { setCity(""); setName(""); setPhone(""); }
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-2">
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Which city? e.g. Jaipur" className="h-11 rounded-xl border border-line bg-white px-3 text-[14px]" />
      <select value={userType} onChange={(e) => setUserType(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-[14px] font-semibold">
        <option value="seeker">I am looking for a home</option>
        <option value="broker">I am a broker there</option>
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 rounded-xl border border-line bg-white px-3 text-[14px]" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className="h-11 rounded-xl border border-line bg-white px-3 text-[14px]" />
      <button className="sm:col-span-2 bg-saffron text-white font-extrabold py-3 rounded-2xl hover:bg-saffrondark transition text-[14px]">Notify me at launch</button>
      {msg && <div className="sm:col-span-2 bg-mist border border-pine/25 rounded-xl p-3 text-[13px] font-semibold text-pinedark">{msg}</div>}
    </form>
  );
}
