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

export function setVoiceSamples(samples: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = samples.map((s) => s.trim()).filter(Boolean).slice(0, 8);
  localStorage.setItem(VOICE_KEY, JSON.stringify(cleaned));
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
