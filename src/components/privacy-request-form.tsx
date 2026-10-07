"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { PRIVACY_REQUEST_TYPES } from "@/lib/policies";
export default function PrivacyRequestForm({ email = "" }: { email?: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget, f = new FormData(form);
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const result = await request("/api/privacy-requests", { kind: f.get("kind"), email: f.get("email"), details: f.get("details") });
      form.reset();
      setMessage(`Request recorded. Keep your reference: ${result.request.id}. Signed-in requests appear below. Guest requests receive a reply at the supplied email after necessary identity checks; no automatic email confirmation is sent.`);
      router.refresh();
    } catch (e) { setFailed(true); setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="bg-cream border border-line rounded-3xl p-5 sm:p-8 space-y-4">
    <label>Request type<select name="kind" required>{PRIVACY_REQUEST_TYPES.map(kind => <option key={kind}>{kind}</option>)}</select></label>
    <label>Contact email<input type="email" name="email" defaultValue={email} readOnly={!!email} required maxLength={254} autoComplete="email" /></label>
    <label>What would you like us to do?<textarea name="details" required minLength={10} maxLength={2000} rows={5} placeholder="Describe the data or decision involved and the change you want. Include a case/property reference if relevant." /></label>
    <p className="text-xs text-ink/65">This goes to the review team, not to a broker. Do not include passwords, OTPs, full identity numbers or payment credentials. We verify identity before releasing information or changing an account.</p>
    <button className="button" disabled={busy}>{busy ? "Recording request…" : "Send request"}</button>
    {message && <p role={failed ? "alert" : "status"} className={`text-sm break-words ${failed ? "text-red-700" : "text-pinedark"}`}>{message}</p>}
  </form>;
}

export function PrivacyRequestReview({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  if (status === "Closed") return null;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget, f = new FormData(form);
    setBusy(true); setMessage("");
    try {
      await request(`/api/privacy-requests/${id}`, { status: status === "Open" ? "Reviewing" : "Closed", expectedStatus: status, response: f.get("response") }, "PATCH");
      form.reset(); router.refresh();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-2">
    <label>Response visible to the requester<textarea name="response" required minLength={10} maxLength={2000} rows={3} placeholder={status === "Open" ? "Acknowledge the request and explain any necessary identity check." : "Explain the completed action, remaining retention and any next step."} /></label>
    {status === "Reviewing" && <p className="text-xs text-ink/65">Complete the underlying authorised action before closing. Closing this case records your response; it does not itself delete an account or documents.</p>}
    <button className="button" disabled={busy}>{busy ? "Saving…" : status === "Open" ? "Acknowledge & start review" : "Record outcome & close"}</button>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
  </form>;
}
