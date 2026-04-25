"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import BriefResult from "@/components/BriefResult";
import { addToHistory } from "@/lib/storage";
import { newId } from "@/lib/utils";
import type { PreShootInput, PreShootOutput } from "@/types";

const defaults: PreShootInput = {
  contentType: "listing_tour",
  targetAudience: "Young-family buyers in Victoria BC",
  location: "Victoria BC, Canada",
  videoLength: "60s",
  platform: "instagram",
  concept: "",
  details: "",
};

export default function PreShootPage() {
  const [input, setInput] = useState<PreShootInput>(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<PreShootOutput | null>(null);

  function update<K extends keyof PreShootInput>(
    key: K,
    value: PreShootInput[K]
  ) {
    setInput((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch("/api/pre-shoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setOutput(data.output);
      addToHistory({
        kind: "brief",
        id: newId(),
        createdAt: new Date().toISOString(),
        input,
        output: data.output,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Pre-Shoot Brief</h1>
        <p className="mt-1 text-sm text-muted">
          Fill in the concept. Mintflow returns a hook, shot list, title
          options, thumbnail direction, and retention plan.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Content type">
            <select
              value={input.contentType}
              onChange={(e) =>
                update("contentType", e.target.value as PreShootInput["contentType"])
              }
            >
              <option value="listing_tour">Listing Tour</option>
              <option value="renovation_walkthrough">
                Renovation Walkthrough
              </option>
              <option value="before_after">Before / After</option>
              <option value="contractor_feature">Contractor Feature</option>
              <option value="explainer">Explainer</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Primary platform">
            <select
              value={input.platform}
              onChange={(e) =>
                update("platform", e.target.value as PreShootInput["platform"])
              }
            >
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="youtube_shorts">YouTube Shorts</option>
              <option value="linkedin">LinkedIn</option>
              <option value="all">All platforms</option>
            </select>
          </Field>

          <Field label="Target audience">
            <input
              type="text"
              value={input.targetAudience}
              onChange={(e) => update("targetAudience", e.target.value)}
            />
          </Field>

          <Field label="Location context">
            <input
              type="text"
              value={input.location}
              onChange={(e) => update("location", e.target.value)}
            />
          </Field>

          <Field label="Target video length">
            <select
              value={input.videoLength}
              onChange={(e) =>
                update("videoLength", e.target.value as PreShootInput["videoLength"])
              }
            >
              <option value="15s">15 sec Reel</option>
              <option value="30s">30 sec Reel</option>
              <option value="60s">60 sec Reel</option>
              <option value="90s">90 sec Reel</option>
              <option value="3-5min">3–5 min YouTube</option>
              <option value="5-10min">5–10 min YouTube</option>
            </select>
          </Field>
        </div>

        <Field label="Concept (one line)">
          <input
            type="text"
            value={input.concept}
            onChange={(e) => update("concept", e.target.value)}
            placeholder="Walk through the kitchen reno at 432 Cook St, highlight the quartz waterfall"
            required
          />
        </Field>

        <Field label="Additional project details (optional)">
          <textarea
            rows={3}
            value={input.details}
            onChange={(e) => update("details", e.target.value)}
            placeholder="MLS specs, reno scope, unique features, seller's story..."
          />
        </Field>

        {error && (
          <div className="rounded-md border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={loading || !input.concept}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Brief"
            )}
          </button>
        </div>
      </form>

      {output && <BriefResult output={output} />}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
