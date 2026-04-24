import CopyButton from "./CopyButton";
import type { PreShootOutput } from "@/types";

export default function BriefResult({ output }: { output: PreShootOutput }) {
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
                <CopyButton text={h.line} />
              </div>
            </div>
          ))}
        </div>
      </Section>

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
              <CopyButton text={t} />
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
    </div>
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
