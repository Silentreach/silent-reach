// Server-side reads of user context (voice samples + brand kit + notes).
// Used inside API route handlers when generating Claude prompts. Falls back
// to empty values if the user isn't signed in (which shouldn't happen post-auth
// gate but the migration period might have edge cases).

import { createClient } from "@/lib/supabase/server";
import type { UserContext } from "@/types";

export async function getServerUserContext(): Promise<UserContext> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { voiceSamples: [], voiceNotes: "", brand: {} };

  const [{ data: profile }, { data: samples }] = await Promise.all([
    supabase
      .from("users")
      .select("voice_notes, org_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("voice_samples")
      .select("text")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  let brandKit = {};
  if (profile?.org_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("brand_kit")
      .eq("id", profile.org_id)
      .single();
    brandKit = org?.brand_kit || {};
  }

  return {
    voiceSamples: (samples || []).map((s) => s.text),
    voiceNotes: profile?.voice_notes || "",
    brand: brandKit,
  };
}
