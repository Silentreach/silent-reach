"use client";

/* DB-backed outcome operations. Replaces lib/outcomes.ts (localStorage) for
   signed-in users. Outcomes live as columns on the reels table since each
   outcome maps 1-to-1 with a reel. */

import { createClient } from "@/lib/supabase/client";

export type OutcomeStatus = "pending" | "shipped" | "skipped";

export interface OutcomeUpdate {
  reelId: string;
  status: OutcomeStatus;
  reach?: number;
  notes?: string;
}

/** Update an outcome for a specific reel. */
export async function setReelOutcome(input: OutcomeUpdate): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("reels")
    .update({
      outcome_status: input.status,
      outcome_reach: typeof input.reach === "number" ? input.reach : null,
      outcome_notes: input.notes || null,
      outcome_updated_at: new Date().toISOString(),
    })
    .eq("id", input.reelId);
  if (error) {
    console.warn("[outcomes] update failed:", error);
    return false;
  }
  return true;
}

export interface OutcomeStats {
  total: number;
  shipped: number;
  pending: number;
  skipped: number;
  shipRate: number;
  withReach: number;
  meanReach: number | null;
  medianReach: number | null;
}

/** Aggregate outcome stats for the current org's rendered reels.
 *  RLS restricts the query to the user's own org automatically. */
export async function computeOutcomeStats(): Promise<OutcomeStats> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reels")
    .select("outcome_status, outcome_reach")
    .eq("status", "rendered");

  if (error || !data) {
    return { total: 0, shipped: 0, pending: 0, skipped: 0, shipRate: 0, withReach: 0, meanReach: null, medianReach: null };
  }

  const all = data as { outcome_status: string | null; outcome_reach: number | null }[];
  const shipped = all.filter((o) => o.outcome_status === "shipped");
  const pending = all.filter((o) => o.outcome_status === "pending" || !o.outcome_status);
  const skipped = all.filter((o) => o.outcome_status === "skipped");
  const reachVals = shipped
    .map((o) => o.outcome_reach)
    .filter((r): r is number => typeof r === "number" && r > 0)
    .sort((a, b) => a - b);

  const meanReach = reachVals.length
    ? Math.round(reachVals.reduce((a, b) => a + b, 0) / reachVals.length)
    : null;
  const medianReach = reachVals.length
    ? reachVals[Math.floor(reachVals.length / 2)]
    : null;

  return {
    total: all.length,
    shipped: shipped.length,
    pending: pending.length,
    skipped: skipped.length,
    shipRate: all.length ? shipped.length / all.length : 0,
    withReach: reachVals.length,
    meanReach,
    medianReach,
  };
}
