"use client";

import { createClient } from "@/lib/supabase/client";

export interface BrandKit {
  name?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoDataUrl?: string;
}

export async function getBrandKit(): Promise<BrandKit> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return {};

  const { data, error } = await supabase
    .from("organizations")
    .select("brand_kit")
    .eq("id", profile.org_id)
    .single();
  if (error || !data?.brand_kit) return {};
  const raw = (data.brand_kit as BrandKit) || {};
  return {
    ...raw,
    primaryColor:   safeHex(raw.primaryColor, "#0a0a0a"),
    secondaryColor: safeHex(raw.secondaryColor, "#d4af37"),
  };
}

export async function setBrandKit(kit: BrandKit): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("User profile missing");

  const { error } = await supabase
    .from("organizations")
    .update({ brand_kit: kit })
    .eq("id", profile.org_id);
  if (error) throw error;
}


const HEX_RX = /^#[0-9a-f]{3,8}$/i;
function safeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return HEX_RX.test(value) ? value : fallback;
}
