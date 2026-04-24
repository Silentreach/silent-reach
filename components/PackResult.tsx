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
  | "thumbnail"
  | "chapters"
  | "clips"
  | "tags";

const TABS: { id: Tab; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "titles", label: "Titles" },
  { id: "hooks", label: "Hook Rewrites" },
  { id: "thumbnail", label: "Thumbnail" },
  { id: "clips", label: "Clips" },
  { id: "chapters", label: "Chapters" },
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
      <div className="flex gap-4 rounded-lg border border-border bg-surface p-4">
        {meta.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.thumbnailUrl}
            alt=""
            className="h-24 w-auto rounded border border-border object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted">Video</div>
          <div className="mt-0.5 truncate font-medium">{meta.title}</div>
          <div className="mt-1 text-xs text-muted">
            {meta.channelTitle} · {Math.floor(meta.durationSeconds / 60)}m{" "}
            {meta.durationSeconds % 60}s
          </div>
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

        {tab === "thumbnail" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
              {meta.thumbnailUrl && (
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="mb-2 text-xs text-muted">Current thumbnail</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={meta.thumbnailUrl}
                    alt=""
                    className="w-full rounded border border-border"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pack.thumbnailRecommendation.design.colorPalette.map(
                      (hex, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 rounded border border-border bg-bg/50 px-2 py-1"
                        >
                          <span
                            className="h-4 w-4 rounded border border-border"
                            style={{ background: hex }}
                          />
                          <span className="font-mono text-[10px] text-muted">
                            {hex}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <Block
                  label="What's working"
                  text={pack.thumbnailRecommendation.currentStrengths}
                />
                <Block
                  label="What could be stronger"
                  text={pack.thumbnailRecommendation.currentWeaknesses}
                />
                <Block
                  label="Suggested overlay text"
                  text={`"${pack.thumbnailRecommendation.overlayText}"`}
                  highlight
                  copyText={pack.thumbnailRecommendation.overlayText}
                />
                <Block
                  label="Composition direction"
                  text={pack.thumbnailRecommendation.compositionNotes}
                />
                <Block
                  label="Mood"
                  text={pack.thumbnailRecommendation.moodDirection}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold">
                  Typography
                </div>
                <CopyButton
                  label="Copy typography spec"
                  text={`Font: ${pack.thumbnailRecommendation.typography.fontFamily}
Weight / Case: ${pack.thumbnailRecommendation.typography.weightAndCase}
Color & Treatment: ${pack.thumbnailRecommendation.typography.colorAndTreatment}
Positioning: ${pack.thumbnailRecommendation.typography.positioning}`}
                />
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <SpecRow
                  label="Font family"
                  value={pack.thumbnailRecommendation.typography.fontFamily}
                />
                <SpecRow
                  label="Weight / case"
                  value={pack.thumbnailRecommendation.typography.weightAndCase}
                />
                <SpecRow
                  label="Color + treatment"
                  value={
                    pack.thumbnailRecommendation.typography.colorAndTreatment
                  }
                />
                <SpecRow
                  label="Positioning"
                  value={pack.thumbnailRecommendation.typography.positioning}
                />
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-gold">
                  Design &amp; palette
                </div>
                <CopyButton
                  label="Copy design spec"
                  text={`Palette: ${pack.thumbnailRecommendation.design.colorPalette.join(", ")}
Background: ${pack.thumbnailRecommendation.design.backgroundTreatment}
Accent elements: ${pack.thumbnailRecommendation.design.accentElements}
Aspect: ${pack.thumbnailRecommendation.design.aspectNotes}`}
                />
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <SpecRow
                  label="Background treatment"
                  value={
                    pack.thumbnailRecommendation.design.backgroundTreatment
                  }
                />
                <SpecRow
                  label="Accent elements"
                  value={pack.thumbnailRecommendation.design.accentElements}
                />
                <SpecRow
                  label="Aspect / crop notes"
                  value={pack.thumbnailRecommendation.design.aspectNotes}
                />
                <SpecRow
                  label="Color palette"
                  value={pack.thumbnailRecommendation.design.colorPalette.join(
                    " · "
                  )}
                />
              </dl>
            </div>
          </div>
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

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1 leading-relaxed">{value}</dd>
    </div>
  );
}

function Block({
  label,
  text,
  highlight,
  copyText,
}: {
  label: string;
  text: string;
  highlight?: boolean;
  copyText?: string;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (highlight
          ? "border-gold/40 bg-gold/5"
          : "border-border bg-surface")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {label}
          </div>
          <div
            className={
              "mt-1 text-sm " + (highlight ? "text-gold font-medium" : "")
            }
          >
            {text}
          </div>
        </div>
        {copyText && <CopyButton text={copyText} />}
      </div>
    </div>
  );
}
