"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/navigation";
function AuthForm() {
  const sp = useSearchParams(),
    next = safeNext(sp.get("next"));
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const [mode, setMode] = useState("email"),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(sp.get("error") ?? ""),
    [info, setInfo] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const sb = createClient();
      const result =
        mode === "password"
          ? await sb.auth.signInWithPassword({ email: email.trim(), password })
          : sent
            ? await sb.auth.verifyOtp({
                email: email.trim(),
                token: code.trim(),
                type: "email",
              })
            : await sb.auth.signInWithOtp({
                email: email.trim(),
                options: {
                  shouldCreateUser: true,
                  emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                },
              });
      if (result.error) throw result.error;
      if (mode === "email" && !sent) {
        setSent(true);
        setInfo(
          "Check your email for a sign-in link or code. You can paste the code below.",
        );
      } else {
        // Read the new session on the server instead of reusing an anonymous prefetch.
        window.location.replace(next);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="eyebrow">THIKANA.RENT · SIGN IN</div>
      <h1 className="display text-4xl font-black">Welcome back.</h1>
      <p className="mt-2 text-ink/65">
        Keep your saved homes, enquiries and visits in one place.
      </p>
      <div className="flex gap-2 mt-6">
        <button
          className={mode === "email" ? "button" : "button secondary"}
          disabled={busy}
          onClick={() => {
            setMode("email");
            setError("");
          }}
        >
          Email link / code
        </button>
        <button
          className={mode === "password" ? "button" : "button secondary"}
          disabled={busy}
          onClick={() => {
            setMode("password");
            setSent(false);
            setError("");
          }}
        >
          Password
        </button>
      </div>
      <form
        key={`${mode}-${sent}`}
        onSubmit={submit}
        className="mt-6 space-y-4"
      >
        {!sent && (
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {mode === "password" && (
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {sent && (
          <>
            <p className="text-sm">Code sent to {email}</p>
            <label>
              Email code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                minLength={6}
                maxLength={10}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 text-sm">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="text-pine text-sm">
            {info}
          </p>
        )}
        <button className="button w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "password"
              ? "Sign in"
              : sent
                ? "Verify & sign in"
                : "Send sign-in email"}
        </button>
        {sent && (
          <button
            type="button"
            className="text-sm underline w-full"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              setSent(false);
              setCode("");
              setInfo("");
              setError("");
            }}
          >
            Use a different email
          </button>
        )}
      </form>
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
