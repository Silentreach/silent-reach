"use client";

/* Outcome tracking — the foundation of Mintflow's private dataset.
   Each pack/brief generated can have an outcome attached:
   "did you ship this?" → "yes, here's the 24h reach". Over time
   this becomes the moat (what hooks/thumbnails actually performed). */

export type OutcomeStatus = "pending" | "shipped" | "skipped";

export interface Outcome {
  itemId: string;          // History item id
  itemKind: "brief" | "pack";
  status: OutcomeStatus;
  reach?: number;          // 24h non-follower reach (for packs)
  notes?: string;          // optional free-text reflection
  createdAt: number;
  updatedAt: number;
}

const KEY = "mintflow_outcomes";

function read(): Record<string, Outcome> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
function write(map: Record<string, Outcome>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getOutcome(itemId: string): Outcome | undefined {
  return read()[itemId];
}

export function getAllOutcomes(): Outcome[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function setOutcome(o: Omit<Outcome, "createdAt" | "updatedAt"> & Partial<Pick<Outcome, "createdAt">>) {
  const map = read();
  const existing = map[o.itemId];
  const now = Date.now();
  map[o.itemId] = {
    ...existing,
    ...o,
    createdAt: existing?.createdAt ?? o.createdAt ?? now,
    updatedAt: now,
  };
  write(map);
}

export function clearOutcome(itemId: string) {
  const map = read();
  delete map[itemId];
  write(map);
}

/* Aggregate stats — used by the dashboard. Defensive: returns sane defaults
   even with zero data so the dashboard never crashes. */
export interface OutcomeStats {
  total: number;
  shipped: number;
  pending: number;
  skipped: number;
  shipRate: number;            // 0–1
  withReach: number;
  meanReach: number | null;    // null if no reach data
  medianReach: number | null;
}

export function computeStats(): OutcomeStats {
  const all = getAllOutcomes();
  const shipped = all.filter((o) => o.status === "shipped");
  const pending = all.filter((o) => o.status === "pending");
  const skipped = all.filter((o) => o.status === "skipped");
  const withReach = shipped.filter((o) => typeof o.reach === "number" && o.reach > 0);
  const reachVals = withReach.map((o) => o.reach as number).sort((a, b) => a - b);
  const meanReach = reachVals.length ? Math.round(reachVals.reduce((a, b) => a + b, 0) / reachVals.length) : null;
  const medianReach = reachVals.length
    ? reachVals[Math.floor(reachVals.length / 2)]
    : null;
  return {
    total: all.length,
    shipped: shipped.length,
    pending: pending.length,
    skipped: skipped.length,
    shipRate: all.length ? shipped.length / all.length : 0,
    withReach: withReach.length,
    meanReach,
    medianReach,
  };
}
