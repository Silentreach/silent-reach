"use client";

// One-shot migration: pushes localStorage data to Supabase, then marks the
// user as migrated so we don't re-run on every page load.
//
// Idempotent: safe to call multiple times — it bails immediately if the user
// is already migrated. Safe even if localStorage is empty.

import { createClient } from "@/lib/supabase/client";
import { replaceAllVoiceSamples } from "./voiceSamples";
import { setBrandKit, type BrandKit } from "./brandKit";
import { setVoiceNotes } from "./voiceNotes";

const VOICE_KEY  = "mintflow_voice_samples";
const NOTES_KEY  = "mintflow_voice_notes";
const BRAND_KEY  = "mintflow_brand_kit";

export async function migrateLocalStorageIfNeeded(): Promise<{
  migrated: boolean;
  reason?: string;
}> {
  if (typeof window === "undefined") return { migrated: false, reason: "ssr" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { migrated: false, reason: "not_signed_in" };

  // Skip if already migrated
  const { data: profile } = await supabase
    .from("users")
    .select("migrated_localstorage_at")
    .eq("id", user.id)
    .single();
  if (profile?.migrated_localstorage_at) {
    return { migrated: false, reason: "already_migrated" };
  }

  // Read everything from localStorage (defensive parsing)
  const samples = readJsonArray(VOICE_KEY) as string[];
  const notes = localStorage.getItem(NOTES_KEY) || "";
  const brand = readJsonObject(BRAND_KEY) as BrandKit;

  const hasAnything = samples.length > 0 || notes.length > 0 || Object.keys(brand).length > 0;
  if (!hasAnything) {
    // Mark as migrated so we don't re-check every load
    await supabase
      .from("users")
      .update({ migrated_localstorage_at: new Date().toISOString() })
      .eq("id", user.id);
    return { migrated: true, reason: "nothing_to_migrate" };
  }

  // Push everything in parallel; ignore individual failures so a single
  // bad blob doesn't block the whole migration.
  const results = await Promise.allSettled([
    samples.length > 0 ? replaceAllVoiceSamples(samples) : Promise.resolve(),
    notes ? setVoiceNotes(notes) : Promise.resolve(),
    Object.keys(brand).length > 0 ? setBrandKit(brand) : Promise.resolve(),
  ]);

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn("[migrate] some pushes failed:", failed);
  }

  await supabase
    .from("users")
    .update({ migrated_localstorage_at: new Date().toISOString() })
    .eq("id", user.id);

  return { migrated: true, reason: "ok" };
}

function readJsonArray(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readJsonObject(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
