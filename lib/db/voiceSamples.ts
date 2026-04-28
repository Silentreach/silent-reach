"use client";

// Async voice-sample storage backed by Supabase.
// Replaces the localStorage-only `lib/userContext.ts` for users who are signed
// in. Server-side prompt builders should call the server variant in
// `lib/db/serverContext.ts` to fetch the same data.

import { createClient } from "@/lib/supabase/client";

export const VOICE_SAMPLE_MAX = 20;
export const VOICE_SAMPLE_RECOMMENDED = 12;

export interface VoiceSampleRow {
  id: string;
  text: string;
  source: string;
  created_at: string;
}

export async function listVoiceSamples(): Promise<VoiceSampleRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("voice_samples")
    .select("id, text, source, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addVoiceSample(text: string, source = "manual"): Promise<VoiceSampleRow> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Sample is empty");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Look up org_id (RLS-safe — current_org_id() handles this server-side too)
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("User profile missing");

  const { data, error } = await supabase
    .from("voice_samples")
    .insert({ text: trimmed, source, user_id: user.id, org_id: profile.org_id })
    .select("id, text, source, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVoiceSample(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("voice_samples").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceAllVoiceSamples(samples: string[]): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("User profile missing");

  // Wipe + reinsert. The voice_samples table has no unique key on text so
  // duplicates would accumulate otherwise.
  await supabase.from("voice_samples").delete().eq("user_id", user.id);

  const cleaned = samples
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, VOICE_SAMPLE_MAX);

  if (cleaned.length === 0) return;

  const rows = cleaned.map((text) => ({
    text,
    source: "manual" as const,
    user_id: user.id,
    org_id: profile.org_id,
  }));
  const { error } = await supabase.from("voice_samples").insert(rows);
  if (error) throw error;
}

export type VoiceStrength = "none" | "weak" | "good" | "strong";

export function computeVoiceStrength(samples: VoiceSampleRow[] | string[]): VoiceStrength {
  const texts = (samples as Array<VoiceSampleRow | string>).map((s) =>
    typeof s === "string" ? s : s.text
  );
  const valid = texts.filter((s) => s.trim().length >= 25);
  if (valid.length === 0) return "none";
  if (valid.length < 3) return "weak";
  if (valid.length < VOICE_SAMPLE_RECOMMENDED) return "good";
  return "strong";
}
