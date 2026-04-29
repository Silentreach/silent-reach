"use client";

/* Async CRUD for the public.reels table — replaces lib/storage.ts (localStorage-
   only) for signed-in users. Reels are scoped to the user's org via RLS. */

import { createClient } from "@/lib/supabase/client";
import type { ReelContentType } from "@/types";

export interface ReelRow {
  id: string;
  org_id: string;
  user_id: string;
  title: string | null;
  source_video_url: string | null;
  duration_sec: number | null;
  content_type: ReelContentType | null;
  packages_json: unknown;
  rendered_urls: unknown;
  status: "draft" | "rendered" | "archived";
  outcome_status: "pending" | "shipped" | "skipped" | null;
  outcome_reach: number | null;
  outcome_notes: string | null;
  outcome_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReelInput {
  title?: string;
  source_video_url?: string;
  duration_sec?: number;
  content_type?: ReelContentType;
  packages_json?: unknown;
  rendered_urls?: unknown;
  status?: "draft" | "rendered" | "archived";
}

/** Insert a new reel row scoped to the current user's org. */
export async function createReel(input: CreateReelInput): Promise<ReelRow | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.org_id) return null;

  const { data, error } = await supabase
    .from("reels")
    .insert({
      org_id: profile.org_id,
      user_id: user.id,
      title: input.title || null,
      source_video_url: input.source_video_url || null,
      duration_sec: input.duration_sec || null,
      content_type: input.content_type || "real_estate",
      packages_json: input.packages_json || null,
      rendered_urls: input.rendered_urls || null,
      status: input.status || "rendered",
      outcome_status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    console.warn("[reels] create failed:", error);
    return null;
  }
  return data as ReelRow;
}

/** List reels for the current user's org, newest first. */
export async function listReels(limit = 50): Promise<ReelRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[reels] list failed:", error);
    return [];
  }
  return (data || []) as ReelRow[];
}

/** Reels rendered ≥3 days ago that still have outcome_status='pending'.
 *  Drives the Day-3 reminder banner. */
export async function listPendingDay3Reels(): Promise<ReelRow[]> {
  const supabase = createClient();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .eq("outcome_status", "pending")
    .eq("status", "rendered")
    .lte("created_at", threeDaysAgo)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("[reels] day-3 query failed:", error);
    return [];
  }
  return (data || []) as ReelRow[];
}
