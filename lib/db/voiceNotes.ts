"use client";

import { createClient } from "@/lib/supabase/client";

export async function getVoiceNotes(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";
  const { data, error } = await supabase
    .from("users")
    .select("voice_notes")
    .eq("id", user.id)
    .single();
  if (error || !data) return "";
  return data.voice_notes || "";
}

export async function setVoiceNotes(notes: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("users")
    .update({ voice_notes: notes.trim() })
    .eq("id", user.id);
  if (error) throw error;
}
