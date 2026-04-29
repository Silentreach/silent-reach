"use client";

import { ReactNode } from "react";
import type { Mood } from "@/types/preProduction";

/* ---- Field wrapper — label + helper text ---- */

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/90">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </label>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-muted/70">{hint}</span>}
    </div>
  );
}

/* ---- Chip selector — single or multi, controlled ---- */

export interface ChipOption<V extends string> {
  id: V;
  label: string;
  hint?: string;
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  multi,
  max,
}: {
  options: readonly ChipOption<V>[];
  value: V[];
  onChange: (next: V[]) => void;
  multi?: boolean;
  max?: number;
}) {
  const toggle = (id: V) => {
    const has = value.includes(id);
    if (!multi) return onChange(has ? [] : [id]);
    if (has) return onChange(value.filter((v) => v !== id));
    if (max != null && value.length >= max) {
      // Replace the oldest selection — feels more like "you can pick up to N" than rejection.
      return onChange([...value.slice(1), id]);
    }
    onChange([...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={active}
            className={[
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
              active
                ? "bg-gold text-black"
                : "border border-border/70 text-muted hover:border-gold/40 hover:text-text",
            ].join(" ")}
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Mood picker — universal, multi-select up to 2 ---- */

export const MOODS: readonly ChipOption<Mood>[] = [
  { id: "cinematic",   label: "Cinematic",   hint: "Slow, deliberate, anamorphic feel" },
  { id: "documentary", label: "Documentary", hint: "Handheld, real, unpolished" },
  { id: "energetic",   label: "Energetic",   hint: "Fast cuts, motion, beat-driven" },
  { id: "calm",        label: "Calm",        hint: "Wide, still, breathable" },
  { id: "luxury",      label: "Luxury",      hint: "Controlled, glossy, restrained" },
  { id: "editorial",   label: "Editorial",   hint: "Magazine-grade composition, negative space" },
];

export function MoodPicker({
  value,
  onChange,
}: {
  value: Mood[];
  onChange: (next: Mood[]) => void;
}) {
  return <ChipGroup options={MOODS} value={value} onChange={onChange} multi max={2} />;
}

/* ---- Plain text input — same look as the existing form ---- */

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-md border border-border bg-bg px-3 py-2.5 text-[14px] text-text placeholder:text-muted/50 focus:border-gold/60 focus:outline-none disabled:opacity-60",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-md border border-border bg-bg px-3 py-2.5 text-[14px] text-text placeholder:text-muted/50 focus:border-gold/60 focus:outline-none disabled:opacity-60",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Select<V extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  options: readonly { id: V; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
      className={[
        "w-full rounded-md border border-border bg-bg px-3 py-2.5 text-[14px] text-text focus:border-gold/60 focus:outline-none",
        className ?? "",
      ].join(" ")}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---- Collapsible "Adjust details" wrapper for Row 2 ---- */

export function AdjustDetails({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg-deep/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-[12px] font-medium uppercase tracking-[0.15em] text-muted transition hover:text-text"
      >
        <span>Adjust details</span>
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && <div className="border-t border-border/50 px-5 py-5 grid gap-4">{children}</div>}
    </div>
  );
}

/* ---- Section header inside a form card ---- */

export function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold/80">
      {children}
    </div>
  );
}
