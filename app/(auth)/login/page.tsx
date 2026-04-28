"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/";
  const inviteCode = sp.get("code") || "";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const validate = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const result = await validate.json();
      if (!validate.ok) throw new Error(result.error || "Could not send magic link");
      setStatus("sent");
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
        {status === "sent" ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✉️</div>
            <h2 className="text-xl font-medium text-white mb-2">Check your email</h2>
            <p className="text-sm text-neutral-400">
              We sent a magic link to <span className="text-white">{email}</span>. Click it to sign in.
            </p>
            <button onClick={() => setStatus("idle")} className="mt-6 text-sm text-neutral-500 hover:text-neutral-300">
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
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
              {status === "sending" ? "Sending magic link…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-neutral-600 text-center mt-6">
        By signing in you agree to use Mintflow responsibly during private beta.
        {redirect !== "/" && <span className="block mt-1">You&apos;ll return to {redirect} after sign-in.</span>}
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
