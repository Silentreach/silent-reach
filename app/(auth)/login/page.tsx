"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/";
  const inviteCode = sp.get("code") || "";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const r = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Could not send code");
      setStep("code");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setError(null);
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otp.trim() }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Invalid code");
      // Hard navigation so middleware sees the new session cookie
      window.location.href = redirect;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-white tracking-tight">Mintflow</h1>
        <p className="text-sm text-neutral-400 mt-2">Content production OS for cinematographers</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        {step === "email" ? (
          <form onSubmit={sendLink} className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">
                Invite code <span className="text-neutral-500 text-xs">(if first sign-in)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MINT-XXXXX"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition font-mono tracking-wider"
              />
              <p className="text-xs text-neutral-500 mt-2">
                Mintflow is invite-only during private beta. Returning users can leave this blank.
              </p>
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-medium rounded-lg transition"
            >
              {status === "sending" ? "Sending code…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="text-center mb-2">
              <div className="text-3xl mb-3">📬</div>
              <h2 className="text-lg font-medium text-white">Check your email</h2>
              <p className="text-sm text-neutral-400 mt-1">
                We sent a sign-in code to<br />
                <span className="text-white">{email}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Sign-in code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="00000000"
                autoFocus
                className="w-full px-4 py-4 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500 transition text-center text-2xl font-mono tracking-[0.5em]"
              />
              <p className="text-xs text-neutral-500 mt-2 text-center">
                Paste the code from the email — or click the link in the email instead.
              </p>
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "verifying" || otp.length < 6}
              className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-medium rounded-lg transition"
            >
              {status === "verifying" ? "Signing in…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(null); }}
              className="w-full text-sm text-neutral-500 hover:text-neutral-300 transition"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-neutral-600 text-center mt-6">
        By signing in you agree to use Mintflow responsibly during private beta.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <Suspense fallback={<div className="text-neutral-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
