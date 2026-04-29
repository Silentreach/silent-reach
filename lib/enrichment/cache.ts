/* Simple JSON-payload cache backed by the public.enrichment_cache table.
   Used to respect free-API rate limits (Nominatim 1 req/sec, Overpass
   per-IP throttling) and keep repeat lookups instant. Keys are namespaced
   strings like 'geocode:868 orono ave saanich bc' or 'nearby:48.5152,-123.3651:1km'. */

import { createServiceClient } from "@/lib/supabase/server";

export async function readCache<T = unknown>(cacheKey: string): Promise<T | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("enrichment_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function writeCache(
  cacheKey: string,
  payload: unknown,
  ttlSeconds = 60 * 60 * 24 * 30, // 30 days
): Promise<void> {
  try {
    const sb = createServiceClient();
    const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await sb
      .from("enrichment_cache")
      .upsert({ cache_key: cacheKey, payload, expires_at }, { onConflict: "cache_key" });
  } catch {
    // Cache write failures are non-fatal — the live API call already succeeded.
  }
}

export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, " ");
}

export function roundCoords(lat: number, lng: number, decimals = 4): string {
  const f = (n: number) => n.toFixed(decimals);
  return `${f(lat)},${f(lng)}`;
}
