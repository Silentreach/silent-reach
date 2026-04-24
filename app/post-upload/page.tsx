"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import PackResult from "@/components/PackResult";
import { addToHistory } from "@/lib/storage";
import { newId } from "@/lib/utils";
import type {
  PostUploadInput,
  PostUploadOutput,
  VideoMeta,
} from "@/types";

type Result = { meta: VideoMeta; pack: PostUploadOutput };

export default function PostUploadPage() {
  const [input, setInput] = useState<PostUploadInput>({ youtubeUrl: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needManual, setNeedManual] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [showOverrides, setShowOverrides] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(useManual: boolean) {
    setLoading(true);
    setError(null);
    if (!useManual) setResult(null);
    try {
      const body: PostUploadInput = {
        youtubeUrl: input.youtubeUrl,
        audienceOverride: input.audienceOverride || undefined,
        locationOverride: input.locationOverride || undefined,
        manualTranscript: useManual ? manualTranscript : undefined,
      };
      const res = await fetch("/api/post-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 422 && data.needManualTranscript) {
        setNeedManual(true);
        setError(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResult({ meta: data.meta, pack: data.pack });
      setNeedManual(false);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Post-Upload Pack</h1>
        <p className="mt-1 text-sm text-muted">
          Paste your YouTube URL. Get captions, titles, hook rewrites, chapters,
          and shareable clip timestamps in one pass.
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

        {needManual && (
          <div className="rounded-lg border border-border bg-bg/40 p-4">
            <div className="mb-2 text-xs text-muted">
              Paste the transcript manually (one block, any format):
            </div>
            <textarea
              rows={8}
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              placeholder="[0:00] Welcome to this walkthrough..."
            />
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={loading || !manualTranscript}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold-dim disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Retry with manual transcript"
              )}
            </button>
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

      {result && <PackResult meta={result.meta} pack={result.pack} />}
    </div>
  );
}
