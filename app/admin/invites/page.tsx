"use client";

// Super-admin only. Generate invite codes for testers.
// Access: /admin/invites — middleware ensures you're signed in,
// the API endpoint enforces super_admin.

import { useEffect, useState } from "react";

interface MintedInvite {
  code: string;
  url: string;
  intended_email?: string;
  notes?: string;
}

export default function AdminInvitesPage() {
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<MintedInvite[]>([]);

  async function mint(e: React.FormEvent) {
    e.preventDefault();
    setMinting(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intended_email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to mint invite");
      setMinted((m) => [data, ...m]);
      setEmail("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Mint invite codes</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Each code can be used once. Codes expire after 30 days.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
          <form onSubmit={mint} className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-2">
                Tester email <span className="text-neutral-500 text-xs">(optional — locks the code to one address)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rashid@example.com"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="BC realtor #1 — referred by Sam"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={minting}
              className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 text-black font-medium rounded-lg transition"
            >
              {minting ? "Minting…" : "Mint invite code"}
            </button>
          </form>
        </div>

        {minted.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wide">Recently minted</h2>
            <div className="space-y-3">
              {minted.map((m) => (
                <div key={m.code} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-emerald-400 text-lg tracking-wider">{m.code}</div>
                    <div className="text-xs text-neutral-500 mt-1 truncate">
                      {m.intended_email || "any email"}
                      {m.notes && ` · ${m.notes}`}
                    </div>
                    <div className="text-xs text-neutral-600 mt-1 truncate">{m.url}</div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(m.url)}
                    className="px-3 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-lg shrink-0"
                  >
                    Copy link
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
