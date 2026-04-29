"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, BookmarkCheck, Image as ImageIcon, Send, ListChecks, Camera, Sun, Mic, AlertTriangle, Wand2, CheckCircle2, Shuffle } from "lucide-react";
import CopyButton from "./CopyButton";
import { isSaved, toggleSaved } from "@/lib/library";
import OutcomeCapture from "./OutcomeCapture";
import type { PreShootOutput } from "@/types";

export default function BriefResult({ output, itemId }: { output: PreShootOutput; itemId?: string }) {
  const allText = [
    "HOOKS",
    ...output.hooks.map(
      (h) => `${h.type.toUpperCase()}: ${h.line}\n  → ${h.whyItWorks}`
    ),
    "\nSHOT LIST",
    ...output.shotList.map(
      (s, i) =>
        `${i + 1}. [${s.timestamp}] ${s.shot}${
          s.retentionNote ? `\n   retention: ${s.retentionNote}` : ""
        }`
    ),
    "\nTITLE OPTIONS",
    ...output.titleOptions.map((t, i) => `${i + 1}. ${t}`),
    "\nTHUMBNAIL DIRECTION",
    `  moment: ${output.thumbnailDirection.momentTimestamp}`,
    `  overlay: "${output.thumbnailDirection.overlayText}"`,
    `  tone: ${output.thumbnailDirection.emotionalTone}`,
    "\nPITCH",
    output.pitch,
    "\nLOCAL RELEVANCE NOTES",
    ...output.localRelevanceNotes.map((n, i) => `${i + 1}. ${n}`),
  ].join("\n");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Brief</h2>
        <CopyButton text={allText} label="Copy all" />
      </div>

      <Section title="Hooks">
        <div className="space-y-3">
          {output.hooks.map((h, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gold">
                    {h.type}
                  </div>
                  <div className="mt-1 font-medium">{h.line}</div>
                  <div className="mt-1 text-sm text-muted">{h.whyItWorks}</div>
                </div>
                <div className="flex items-center gap-1">
                  <SaveButton kind="hook" text={h.line} source="From a brief" />
                  <CopyButton text={h.line} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* World-class enrichments — only render if present (backward-compatible with old briefs) */}
      {output.openerVariants && output.openerVariants.length > 0 && (
        <Section title="Opener variants — film both, A/B in editing">
          <div className="grid gap-2 sm:grid-cols-2">
            {output.openerVariants.map((v, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Shuffle className="h-3 w-3 text-gold" />
                  <span className="text-[10px] uppercase tracking-widest text-muted">{v.feel}</span>
                </div>
                <div className="mt-1.5 font-medium leading-snug">&ldquo;{v.line}&rdquo;</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {output.bRollList && output.bRollList.length > 0 && (
        <Section title="B-roll — also grab while on site">
          <ul className="space-y-2">
            {output.bRollList.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
                <div className="flex-1">
                  <div>{b.shot}</div>
                  {b.whyItHelps && <div className="mt-0.5 text-xs text-muted">↳ {b.whyItHelps}</div>}
                </div>
                <SaveButton kind="hook" text={b.shot} source="B-roll list" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {output.filmingNotes && (output.filmingNotes.gear || output.filmingNotes.lighting || output.filmingNotes.timeOfDay || output.filmingNotes.soundCapture || output.filmingNotes.riskCalls) && (
        <Section title="Filming notes">
          <div className="grid gap-2 sm:grid-cols-2">
            {output.filmingNotes.gear && (
              <NoteCard icon={Wand2} label="Gear" body={output.filmingNotes.gear} />
            )}
            {output.filmingNotes.lighting && (
              <NoteCard icon={Sun} label="Lighting" body={output.filmingNotes.lighting} />
            )}
            {output.filmingNotes.timeOfDay && (
              <NoteCard icon={Sun} label="Time of day" body={output.filmingNotes.timeOfDay} />
            )}
            {output.filmingNotes.soundCapture && (
              <NoteCard icon={Mic} label="Sound capture" body={output.filmingNotes.soundCapture} />
            )}
            {output.filmingNotes.riskCalls && (
              <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400/80">
                  <AlertTriangle className="h-3 w-3" /> Risk calls
                </div>
                <div className="mt-1 text-sm text-amber-100/90">{output.filmingNotes.riskCalls}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {output.successChecks && output.successChecks.length > 0 && (
        <Section title="Before you publish — quick checks">
          <ul className="space-y-1.5">
            {output.successChecks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}


      <Section title="Shot List">
        <ol className="space-y-2 text-sm">
          {output.shotList.map((s, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-gold font-mono text-xs shrink-0">
                  {s.timestamp}
                </span>
                <span>{s.shot}</span>
              </div>
              {s.retentionNote && (
                <div className="mt-1 pl-[60px] text-xs text-muted">
                  ↳ {s.retentionNote}
                </div>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Title Options">
        <ul className="space-y-2">
          {output.titleOptions.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5"
            >
              <span className="text-sm">{t}</span>
              <div className="flex items-center gap-1">
                <SaveButton kind="title" text={t} source="From a brief" />
                <CopyButton text={t} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Thumbnail Direction">
        <div className="rounded-lg border border-border bg-surface p-4 text-sm space-y-1">
          <div>
            <span className="text-muted">Grab frame at:</span>{" "}
            <span className="text-gold font-mono">
              {output.thumbnailDirection.momentTimestamp}
            </span>
          </div>
          <div>
            <span className="text-muted">Overlay text:</span>{" "}
            <span>&ldquo;{output.thumbnailDirection.overlayText}&rdquo;</span>
          </div>
          <div>
            <span className="text-muted">Emotional tone:</span>{" "}
            <span>{output.thumbnailDirection.emotionalTone}</span>
          </div>
        </div>
      </Section>

      <Section title="Pitch">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm">
          {output.pitch}
        </p>
      </Section>

      <Section title="Local Relevance Notes">
        <ul className="space-y-2">
          {output.localRelevanceNotes.map((n, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm"
            >
              {n}
            </li>
          ))}
        </ul>
      </Section>

      {itemId && (
        <OutcomeCapture itemId={itemId} itemKind="brief" />
      )}

      {/* Cross-pillar continuity bar */}
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-widest text-gold/80">
              Keep moving
            </div>
            <div className="mt-1 font-display text-lg tracking-tight text-text">
              Take this brief to the next pillar.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/thumbnail-studio?headline=${encodeURIComponent(output.thumbnailDirection.overlayText)}&subtitle=${encodeURIComponent(output.thumbnailDirection.emotionalTone)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg px-4 py-2 text-sm text-text transition hover:border-gold/60 hover:text-gold"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Design the thumbnail in Studio
              </Link>
              <Link
                href="/post-production"
                className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg px-4 py-2 text-sm text-text transition hover:border-gold/60 hover:text-gold"
              >
                <Send className="h-3.5 w-3.5" />
                Generate the post pack
              </Link>
              <Link
                href={`/production/checklist#data=${encodeBriefForChecklist(output)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-bg px-4 py-2 text-sm text-text transition hover:border-gold/60 hover:text-gold"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Open as on-set checklist
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Save (library) button ---------- */
function SaveButton({ kind, text, source }: { kind: "hook" | "title" | "caption"; text: string; source?: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isSaved(text, kind)); }, [text, kind]);
  const onClick = () => {
    const nowSaved = toggleSaved({ kind, text, source });
    setSaved(nowSaved);
  };
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md p-1.5 transition",
        saved ? "text-gold hover:text-gold-light" : "text-muted hover:text-text",
      ].join(" ")}
      aria-label={saved ? "Remove from library" : "Save to library"}
      title={saved ? "Saved — click to remove" : "Save to library"}
    >
      {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* Encode the brief shot list for the on-set checklist URL hash. base64url. */
function encodeBriefForChecklist(output: PreShootOutput): string {
  if (typeof window === "undefined") return "";
  const payload = {
    title: output.titleOptions[0]?.slice(0, 60) || "Today's shoot",
    shots: output.shotList.map((s) => ({
      timestamp: s.timestamp,
      shot: s.shot,
      retentionNote: s.retentionNote,
    })),
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function NoteCard({ icon: Icon, label, body }: { icon: typeof Wand2; label: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gold/80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-sm text-text/90">{body}</div>
    </div>
  );
}
