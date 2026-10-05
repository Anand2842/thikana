"use client";
import { useState } from "react";
import { request } from "@/lib/client-request";
export default function CityRequestForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      await request("/api/city-requests", Object.fromEntries(f));
      setMessage(`Your request for ${f.get("city")} was saved. Thank you!`);
      form.reset();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
      <label>
        City
        <input
          name="city"
          required
          minLength={2}
          maxLength={100}
          placeholder="e.g. Jaipur"
        />
      </label>
      <label>
        I am a
        <select name="userType">
          <option value="seeker">Home seeker</option>
          <option value="broker">Broker</option>
        </select>
      </label>
      <label>
        Your name
        <input
          name="name"
          required
          autoComplete="name"
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        Mobile number
        <input
          name="phone"
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          pattern="[0-9]{10}"
          maxLength={10}
        />
      </label>
      <button className="sm:col-span-2 button" disabled={busy}>
        {busy ? "Saving…" : "Request my city"}
      </button>
      {message && (
        <p role="status" className="sm:col-span-2 text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
