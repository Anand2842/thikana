"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        // Magic-link clicks land on the callback route, which exchanges the
        // code and forwards to ?next=. The 6-digit OTP path stays on this page.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCodeSent(true);
    setInfo(`6-digit code sent to ${email.trim()}.`);
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-16">
      <div className="text-[11px] font-extrabold tracking-[.2em] text-pine">THIKANA.RENT · SIGN IN</div>
      <h1 className="display font-black text-[32px]">Welcome back.</h1>
      <p className="text-ink/60 text-[14px] mt-1">
        {codeSent ? "Enter the 6-digit code from your email." : "Enter your email — we'll send you a 6-digit code."}
      </p>

      {!codeSent ? (
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-cream border border-line rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-ink"
          />
          {error && <p className="text-[13px] font-semibold text-red-700">{error}</p>}
          {info && <p className="text-[13px] font-semibold text-pine">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-white font-bold text-[14px] px-6 py-3 rounded-2xl disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 space-y-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full bg-cream border border-line rounded-2xl px-4 py-3 text-[14px] tracking-[.3em] text-center outline-none focus:border-ink"
          />
          {error && <p className="text-[13px] font-semibold text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-white font-bold text-[14px] px-6 py-3 rounded-2xl disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCodeSent(false);
              setCode("");
              setError(null);
              setInfo(null);
            }}
            className="w-full text-[13px] font-bold text-ink/60 underline"
          >
            Use a different email
          </button>
        </form>
      )}
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
