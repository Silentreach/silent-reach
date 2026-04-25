"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import PackResult from "@/components/PackResult";
import { addToHistory } from "@/lib/storage";
import { getUserContext } from "@/lib/userContext";
import { newId } from "@/lib/utils";
import type {
  PostUploadInput,
  PostUploadOutput,
  VideoMeta,
} from "@/types";

type Result = {
  meta: VideoMeta;
  pack: PostUploadOutput;
  transcriptUsed?: boolean;
  thumbnailUsed?: boolean;
};

export default function PostUploadPage() {
  const [input, setInput] = useState<PostUploadInput>({
    youtubeUrl: "",
    visualContext: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: PostUploadInput = {
        youtubeUrl: input.youtubeUrl,
        audienceOverride: input.audienceOverride || undefined,
        locationOverride: input.locationOverride || undefined,
        visualContext: input.visualContext || undefined,
      };
      const res = await fetch("/api/post-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: body, userContext: getUserContext() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResult({
        meta: data.meta,
        pack: data.pack,
        transcriptUsed: data.transcriptUsed,
        thumbnailUsed: data.thumbnailUsed,
      });
      addToHistory({
        kind: "pack",
        id: newId(),
        createdAt: new Date().toISOString(),
        input: body,
        meta: data.meta,
        output: data.pack,
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
        <h1 className="text-2xl font-semibold">Post-Upload Pack</h1>
        <p className="mt-1 text-sm text-muted">
          Paste your YouTube URL. Works for both dialogue-driven and music-only
          cinematic reels — the thumbnail and description are used as visual
          context when there&apos;s no spoken script.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
            YouTube URL
          </span>
          <input
            type="url"
            required
            value={input.youtubeUrl}
            onChange={(e) =>
              setInput((s) => ({ ...s, youtubeUrl: e.target.value }))
            }
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
            Describe the video (optional but recommended for voice-less reels)
          </span>
          <textarea
            rows={2}
            value={input.visualContext || ""}
            onChange={(e) =>
              setInput((s) => ({ ...s, visualContext: e.target.value }))
            }
            placeholder="Oak Bay waterfront estate at golden hour, drone opener, interior millwork detail at 1:20, payoff shot of east-facing balcony"
          />
          <span className="mt-1 block text-xs text-muted">
            One or two sentences naming the key visuals and their approximate
            timestamps helps Claude write sharper captions and pick better clip
            moments.
          </span>
        </label>

        <button
          type="button"
          onClick={() => setShowOverrides((v) => !v)}
          className="text-left text-xs text-muted hover:text-text"
        >
          {showOverrides ? "− Hide" : "+ Override"} audience / location defaults
        </button>

        {showOverrides && (
          <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-border bg-bg/40 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Audience override
              </span>
              <input
                type="text"
                value={input.audienceOverride || ""}
                onChange={(e) =>
                  setInput((s) => ({ ...s, audienceOverride: e.target.value }))
                }
                placeholder="Victoria BC realtors and buyers"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Location override
              </span>
              <input
                type="text"
                value={input.locationOverride || ""}
                onChange={(e) =>
                  setInput((s) => ({ ...s, locationOverride: e.target.value }))
                }
                placeholder="Victoria BC, Canada"
              />
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={loading || !input.youtubeUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating pack...
              </>
            ) : (
              "Generate Pack"
            )}
          </button>
        </div>
      </form>

      {result && (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            <span
              className={
                "rounded-full border px-2.5 py-0.5 " +
                (result.thumbnailUsed
                  ? "border-gold/40 text-gold"
                  : "border-border")
              }
            >
              Thumbnail vision: {result.thumbnailUsed ? "used" : "skipped"}
            </span>
            <span
              className={
                "rounded-full border px-2.5 py-0.5 " +
                (result.transcriptUsed
                  ? "border-gold/40 text-gold"
                  : "border-border")
              }
            >
              Transcript: {result.transcriptUsed ? "used" : "none (OK)"}
            </span>
          </div>
          <PackResult meta={result.meta} pack={result.pack} />
        </>
      )}
    </div>
  );
}
