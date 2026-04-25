"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export default function EmailCapture({
  cta = "Get early access",
  subtle = false,
}: { cta?: string; subtle?: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    /* TODO wire to a real list (Resend Audience, Loops, ConvertKit). For now we just
       log it in localStorage so the founder can pull it manually if needed. */
    try {
      const existing = JSON.parse(localStorage.getItem("mintflow_waitlist") || "[]");
      existing.push({ email, at: new Date().toISOString() });
      localStorage.setItem("mintflow_waitlist", JSON.stringify(existing));
    } catch {}
    setDone(true);
  };

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-5 py-3 text-sm text-gold">
        <Check className="h-4 w-4" />
        Got it. We&apos;ll be in touch.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={[
        "flex w-full max-w-md items-center gap-2 rounded-full border p-1.5 transition",
        subtle
          ? "border-border bg-surface/60 focus-within:border-gold/60"
          : "border-border-strong bg-surface focus-within:border-gold",
      ].join(" ")}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@studio.com"
        className="!border-0 !bg-transparent !p-0 !pl-3 !shadow-none focus:!ring-0 text-sm text-text placeholder:text-muted/70"
        style={{ outline: "none" }}
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold-light"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
