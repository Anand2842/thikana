"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Factor } from "@supabase/supabase-js";

export default function AdminMfaPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; uri: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const sb = createClient();
    const [{ data: list }, { data: aal }] = await Promise.all([
      sb.auth.mfa.listFactors(),
      sb.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors(list?.totp ?? []);
    setLevel(aal?.currentLevel ?? null);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const [{ data: list }, { data: aal }] = await Promise.all([
        sb.auth.mfa.listFactors(),
        sb.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (cancelled) return;
      setFactors(list?.totp ?? []);
      setLevel(aal?.currentLevel ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  async function startEnroll() {
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      const { data, error } = await sb.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) throw error;
      setEnroll({ id: data.id, uri: data.totp.uri });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finishEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      const challenge = await sb.auth.mfa.challenge({ factorId: enroll.id });
      if (challenge.error) throw challenge.error;
      const { error } = await sb.auth.mfa.verify({
        factorId: enroll.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (error) throw error;
      setEnroll(null);
      setCode("");
      await refresh();
      setMessage("Authenticator enrolled and verified.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function stepUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      const { data: list } = await sb.auth.mfa.listFactors();
      const factor = list?.totp[0];
      if (!factor) throw new Error("Enroll an authenticator first.");
      const challenge = await sb.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challenge.error) throw challenge.error;
      const { error } = await sb.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (error) throw error;
      setCode("");
      await refresh();
      setMessage("Session verified at aal2.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unenroll(id: string) {
    if (!window.confirm("Remove this authenticator?")) return;
    setBusy(true);
    try {
      const { error } = await createClient().auth.mfa.unenroll({
        factorId: id,
      });
      if (error) throw error;
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="eyebrow">ADMIN SECURITY</div>
      <h1 className="display text-4xl font-black mt-2">
        Two-factor authentication
      </h1>
      <p className="mt-3 text-ink/65 text-[15px]">
        Admin console and moderation APIs require a TOTP-verified session
        (aal2). Current session level:{" "}
        <b>{level ?? "unknown"}</b>.
      </p>
      <div className="mt-6 bg-cream border border-line rounded-3xl p-5 sm:p-8 space-y-4">
        <b>Enrolled authenticators ({factors.length})</b>
        {factors.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>
              {f.friendly_name || "Authenticator"} · added{" "}
              {f.created_at.slice(0, 10)}
            </span>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void unenroll(f.id)}
            >
              Remove
            </button>
          </div>
        ))}
        {!factors.length && (
          <p className="text-sm text-ink/65">
            None yet. Enroll below, then verify a code to finish.
          </p>
        )}
        {!enroll ? (
          <button className="button" disabled={busy} onClick={startEnroll}>
            Enroll new authenticator
          </button>
        ) : (
          <form onSubmit={finishEnroll} className="space-y-3">
            <p className="text-sm">
              Scan this URI in your authenticator app (or enter it manually),
              then type the 6-digit code.
            </p>
            <code className="block text-xs break-all bg-paper border border-line rounded-2xl p-3">
              {enroll.uri}
            </code>
            <label>
              Verification code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={8}
                required
              />
            </label>
            <button className="button w-full" disabled={busy}>
              Verify and finish enrollment
            </button>
          </form>
        )}
        <form onSubmit={stepUp} className="space-y-3 border-t border-line pt-4">
          <b className="text-sm">Verify this session (step up to aal2)</b>
          <label>
            Current code from your authenticator
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={8}
              required
            />
          </label>
          <button className="button secondary w-full" disabled={busy}>
            Verify session
          </button>
        </form>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
