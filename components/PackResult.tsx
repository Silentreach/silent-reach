"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import type { PostUploadOutput, VideoMeta } from "@/types";

type Tab =
  | "instagram"
  | "linkedin"
  | "facebook"
  | "titles"
  | "hooks"
  | "chapters"
  | "clips"
  | "tags";

const TABS: { id: Tab; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "titles", label: "Titles" },
  { id: "hooks", label: "Hook Rewrites" },
  { id: "chapters", label: "Chapters" },
  { id: "clips", label: "Clips" },
  { id: "tags", label: "Tags" },
];

export default function PackResult({
  meta,
  pack,
}: {
  meta: VideoMeta;
  pack: PostUploadOutput;
}) {
  const [tab, setTab] = useState<Tab>("instagram");

  const chaptersText = pack.chapterMarkers
    .map((c) => `${c.timestamp} ${c.title}`)
    .join("\n");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs text-muted">Video</div>
        <div className="mt-0.5 font-medium">{meta.title}</div>
        <div className="mt-1 text-xs text-muted">
          {meta.channelTitle} · {Math.floor(meta.durationSeconds / 60)}m{" "}
          {meta.durationSeconds % 60}s
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "border-b-2 px-3 py-2 text-sm transition " +
              (tab === t.id
                ? "border-gold text-text"
                : "border-transparent text-muted hover:text-text")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "instagram" && (
          <TextBlock text={pack.instagramCaption} label="Copy IG caption" />
        )}
        {tab === "linkedin" && (
          <TextBlock text={pack.linkedInPost} label="Copy LinkedIn post" />
        )}
        {tab === "facebook" && (
          <TextBlock text={pack.facebookPost} label="Copy Facebook post" />
        )}

        {tab === "titles" && (
          <ul className="space-y-2">
            {pack.titleVariants.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5"
              >
                <span className="text-sm">{t}</span>
                <CopyButton text={t} />
              </li>
            ))}
          </ul>
        )}

        {tab === "hooks" && (
          <ul className="space-y-3">
            {pack.hookRewrites.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{h.line}</div>
                    <div className="mt-1 text-xs text-muted">
                      {h.worksBestFor}
                    </div>
                  </div>
                  <CopyButton text={h.line} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "chapters" && (
          <>
            {pack.chapterMarkers.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
                Not generated for videos under 90 seconds.
              </p>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs text-muted">
                    Paste into YouTube description
                  </div>
                  <CopyButton text={chaptersText} label="Copy chapters" />
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {chaptersText}
                </pre>
              </div>
            )}
          </>
        )}

        {tab === "clips" && (
          <ul className="space-y-3">
            {pack.shareableClips.map((c, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-mono text-sm text-gold">
                    {c.startTimestamp} → {c.endTimestamp}
                  </div>
                  <CopyButton text={c.suggestedCaption} label="Copy caption" />
                </div>
                <div className="mt-2 text-sm">{c.whyItWorks}</div>
                <div className="mt-2 rounded border border-border bg-bg p-2.5 text-xs text-muted">
                  {c.suggestedCaption}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "tags" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs text-muted">
                Lowercase, no # — algorithms read the video, not the tag.
              </div>
              <CopyButton text={pack.suggestedTags.join(", ")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pack.suggestedTags.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TextBlock({ text, label }: { text: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex justify-end">
        <CopyButton text={text} label={label} />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
