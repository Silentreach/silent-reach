"use client";

import type { UserContext } from "@/types";

const VOICE_KEY = "mintflow_voice_samples";
const NOTES_KEY = "mintflow_voice_notes";
const BRAND_KEY = "mintflow_brand_kit";

/* ───────── Voice samples ───────── */

export function getVoiceSamples(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export const VOICE_SAMPLE_MAX = 20;
export const VOICE_SAMPLE_RECOMMENDED = 12;

export function setVoiceSamples(samples: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = samples.map((s) => s.trim()).filter(Boolean).slice(0, VOICE_SAMPLE_MAX);
  localStorage.setItem(VOICE_KEY, JSON.stringify(cleaned));
}

/**
 * Voice training strength assessment. Drives the per-user prompt fine-tuning:
 * the stronger the voice signal, the more aggressively the prompt insists the
 * AI mimic the user's actual cadence. With <3 samples the prompt only does a
 * gentle nudge; with 12+ it becomes a hard constraint.
 */
export type VoiceStrength = "none" | "weak" | "good" | "strong";

export function getVoiceStrength(): VoiceStrength {
  const samples = getVoiceSamples();
  const valid = samples.filter((s) => s.trim().length >= 25); // a real caption, not a fragment
  if (valid.length === 0) return "none";
  if (valid.length < 3) return "weak";
  if (valid.length < VOICE_SAMPLE_RECOMMENDED) return "good";
  return "strong";
}

export function getVoiceNotes(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NOTES_KEY) || "";
}

export function setVoiceNotes(notes: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTES_KEY, notes.trim());
}

/* ───────── Brand kit ───────── */

export interface BrandKit {
  name?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoDataUrl?: string;
}

export function getBrandKit(): BrandKit {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw ? (JSON.parse(raw) as BrandKit) : {};
  } catch {
    return {};
  }
}

export function setBrandKit(kit: BrandKit) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRAND_KEY, JSON.stringify(kit));
}

/* ───────── Composite (sent with every generation) ───────── */

export function getUserContext(): UserContext {
  return {
    voiceSamples: getVoiceSamples(),
    voiceNotes: getVoiceNotes(),
    brand: getBrandKit(),
  };
}

/* Returns true if the user has filled in enough context to be useful. */
export function hasMeaningfulContext(): boolean {
  const ctx = getUserContext();
  return (
    (ctx.voiceSamples?.length ?? 0) > 0 ||
    !!ctx.voiceNotes ||
    !!ctx.brand?.name
  );
}
