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
  return (data.brand_kit as BrandKit) || {};
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
