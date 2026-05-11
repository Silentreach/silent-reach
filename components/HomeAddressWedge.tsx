"use client";

/**
 * HomeAddressWedge — the hero conversion driver on the public landing page.
 *
 * What it does:
 *   1. User pastes a BC address.
 *   2. We hit /api/enrichment/geocode (Nominatim, BC-biased, 30-day cached).
 *   3. We hit /api/enrichment/nearby (Overpass, one combined query, 30-day cached)
 *      and surface the closest park, school, café, and landmark with real
 *      distances. This is the address-to-shoot-plan wedge made visible
 *      without sign-in.
 *   4. CTA routes to /pre-production?address=...&lat=...&lng=... which the
 *      pre-production page consumes to auto-skip the niche picker, prefill
 *      the address, and reuse the cached enrichment on first generation.
 *
 * Both enrichment endpoints are whitelisted in middleware so anonymous
 * visitors can call them. The cache makes repeat traffic effectively free.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  MapPin,
  Loader2,
  Sparkles,
  TreePine,
  GraduationCap,
  Coffee,
  Camera,
} from "lucide-react";

type Category = "park" | "school" | "cafe" | "landmark";

interface NearbyPlace {
  name: string;
  meters: number;
  category: Category;
}

const ICON: Record<Category, typeof MapPin> = {
  park: TreePine,
  school: GraduationCap,
  cafe: Coffee,
  landmark: Camera,
};

type State = "idle" | "looking" | "found" | "missing";

interface ResolvedResult {
  formatted: string;
  short: string; // first two segments, e.g. "414 Cook Street, Victoria"
  lat: number;
  lng: number;
  places: NearbyPlace[];
}

export default function HomeAddressWedge() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<ResolvedResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (trimmed.length < 6) return;
    setState("looking");
    setResult(null);

    try {
      const geoRes = await fetch("/api/enrichment/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!geoRes.ok) {
        setState("missing");
        return;
      }
      const { result: g } = (await geoRes.json()) as {
        result: { formattedAddress: string; lat: number; lng: number };
      };

      // Nearby is non-fatal — if it fails we still let the user push through
      // with a resolved-address-only card.
      let places: NearbyPlace[] = [];
      try {
        const nbRes = await fetch("/api/enrichment/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: g.lat, lng: g.lng }),
          signal: AbortSignal.timeout(20_000),
        });
        if (nbRes.ok) {
          const { result: n } = (await nbRes.json()) as {
            result: {
              parks: Array<{ name: string; distanceMeters: number }>;
              schools: Array<{ name: string; distanceMeters: number }>;
              amenities: Array<{
                name: string;
                distanceMeters: number;
                osmTags?: { amenity?: string };
              }>;
              landmarks: Array<{ name: string; distanceMeters: number }>;
            };
          };

          const park = n.parks?.[0]
            ? { name: n.parks[0].name, meters: n.parks[0].distanceMeters, category: "park" as Category }
            : null;
          const school = n.schools?.[0]
            ? { name: n.schools[0].name, meters: n.schools[0].distanceMeters, category: "school" as Category }
            : null;
          const cafeRow = (n.amenities ?? []).find((a) =>
            ["restaurant", "cafe", "bakery"].includes(a.osmTags?.amenity ?? ""),
          );
          const cafe = cafeRow
            ? { name: cafeRow.name, meters: cafeRow.distanceMeters, category: "cafe" as Category }
            : null;
          const landmark = n.landmarks?.[0]
            ? { name: n.landmarks[0].name, meters: n.landmarks[0].distanceMeters, category: "landmark" as Category }
            : null;
          places = [park, school, cafe, landmark]
            .filter((p): p is NearbyPlace => p !== null)
            .slice(0, 4);
        }
      } catch {
        // ignore — non-fatal
      }

      setResult({
        formatted: g.formattedAddress,
        short: shortAddress(g.formattedAddress),
        lat: g.lat,
        lng: g.lng,
        places,
      });
      setState("found");
    } catch {
      setState("missing");
    }
  }

  function goToBrief() {
    if (!result) return;
    const qs = new URLSearchParams({
      address: result.short,
      lat: String(result.lat),
      lng: String(result.lng),
    });
    router.push(`/pre-production?${qs.toString()}`);
  }

  return (
    <div className="mx-auto mt-9 w-full max-w-xl animate-fade-up">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/70" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste a BC address — e.g. 414 Cook St, Victoria"
            className="w-full rounded-full border border-border-strong bg-bg-deep/80 py-3.5 pl-11 pr-4 text-sm text-text placeholder:text-muted/70 outline-none transition focus:border-gold/60 focus:ring-1 focus:ring-gold/20"
            autoComplete="off"
            inputMode="search"
            aria-label="Address"
          />
        </div>
        <button
          type="submit"
          disabled={state === "looking" || address.trim().length < 6}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "looking" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading…
            </>
          ) : (
            <>
              Show me
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-2.5 text-center text-[12px] text-muted/80">
        Free preview · no sign-in · OpenStreetMap data
      </div>

      {state === "found" && result && (
        <div className="mt-7 rounded-2xl border border-gold/25 bg-gradient-to-b from-bg-deep to-bg-deep/60 p-5 text-left animate-fade-up sm:p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold/85">
            <Sparkles className="h-3 w-3" />
            What Mintflow sees
          </div>
          <div className="mt-2 font-display text-base leading-snug text-text sm:text-lg">
            {result.short}
          </div>

          {result.places.length > 0 ? (
            <ul className="mt-5 space-y-2.5">
              {result.places.map((p) => {
                const Icon = ICON[p.category];
                return (
                  <li
                    key={`${p.category}-${p.name}`}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-gold/70" />
                    <span className="truncate text-text/90">{p.name}</span>
                    <span className="ml-auto whitespace-nowrap font-mono text-[12px] text-muted">
                      {formatDistance(p.meters)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted">
              Address resolved. The full brief pulls schools, parks, transit, and landmarks at
              finer granularity than this preview.
            </p>
          )}

          <div className="mt-6 flex flex-col items-stretch gap-2 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] leading-relaxed text-muted">
              Next: hooks, shot list, three angles, and why each one works for this neighborhood.
            </p>
            <button
              type="button"
              onClick={goToBrief}
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light"
            >
              Generate full brief
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {state === "missing" && (
        <div className="mt-5 rounded-2xl border border-border/70 bg-bg-deep/60 p-5 text-left text-[13px] text-muted animate-fade-up">
          Couldn&apos;t resolve that address. Try a more specific street and city — or skip the
          preview and{" "}
          <button
            type="button"
            onClick={() => router.push("/pre-production")}
            className="text-gold transition hover:text-gold-light"
          >
            start a brief manually →
          </button>
        </div>
      )}
    </div>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function shortAddress(full: string): string {
  // Nominatim returns "414 Cook Street, Fernwood, Victoria, Capital Regional District, ...".
  // For display + URL param, keep the first two meaningful segments.
  const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return full;
  return `${parts[0]}, ${parts[parts.length >= 3 ? 2 : 1]}`;
}
