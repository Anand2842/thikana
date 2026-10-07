"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { PHASE1_CITIES } from "@/lib/mock-data";

interface Building {
  id: string;
  label: string;
  city: string;
  locality: string;
  revision: number;
}

// Reusable building context: save city/locality/address once, snapshot it
// into each draft. Later building edits never touch existing drafts.
export default function BuildingManager({
  buildings,
}: {
  buildings: Building[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const input =
    "w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]";

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const f = new FormData(e.currentTarget);
      await request("/api/broker/buildings", {
        label: String(f.get("label") ?? ""),
        city: String(f.get("city") ?? ""),
        locality: String(f.get("locality") ?? ""),
        street: String(f.get("street") ?? ""),
        amenities: String(f.get("amenities") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      e.currentTarget.reset();
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <h2 className="font-extrabold">Buildings ({buildings.length})</h2>
      <form
        onSubmit={create}
        className="mt-3 bg-cream border border-line rounded-3xl p-4 space-y-2"
      >
        <b className="text-sm">New building</b>
        <input name="label" maxLength={120} placeholder="Label, e.g. Sunrise Towers" className={input} />
        <select name="city" defaultValue="" className={input} aria-label="City">
          <option value="">City</option>
          {PHASE1_CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input name="locality" maxLength={100} placeholder="Locality" className={input} />
        <input name="street" maxLength={300} placeholder="Building / street address" className={input} />
        <input name="amenities" maxLength={500} placeholder="Common amenities, comma separated" className={input} />
        <button className="button w-full" disabled={busy}>
          Save building
        </button>
      </form>
      {message && (
        <p role="status" className="text-sm mt-2">
          {message}
        </p>
      )}
      <div className="mt-3 space-y-2">
        {buildings.map((b) => (
          <div key={b.id} className="bg-paper border border-line rounded-2xl p-3 text-[13px]">
            <b>{b.label || b.locality || b.id.slice(0, 8)}</b>
            <span className="text-ink/55"> · {b.city}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
