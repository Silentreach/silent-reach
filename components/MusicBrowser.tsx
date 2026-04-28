"use client";

// Pixabay music browser embedded inside a Reel Multiplier package card.
// User searches royalty-free music, previews tracks, picks one — selected
// track is downloaded as a Blob and handed back to the parent so the
// renderer uses it as the music bed.

import { useEffect, useRef, useState } from "react";
import { Loader2, Music, Play, Pause, Check, ExternalLink, Search } from "lucide-react";

export interface PixabayTrack {
  id: number;
  title: string;
  duration: number;
  audioUrl: string;
  previewUrl: string;
  creator: string;
  pageUrl: string;
  tags: string;
}

interface MusicBrowserProps {
  /** AI-suggested search query as the default */
  defaultQuery?: string;
  /** Called when user picks a track — parent fetches it and converts to File */
  onSelect: (track: PixabayTrack, blob: Blob) => void;
  /** Currently selected track id (visual checkmark) */
  selectedId?: number | null;
  /** Suggested duration range for filtering — defaults to 20-120s */
  minDuration?: number;
  maxDuration?: number;
  /** If true, auto-pick the first returned track when no track is yet selected. */
  autoPick?: boolean;
  /** Track IDs already used by other platforms — autoPick will skip these
      so each platform reel ends up with a different track. */
  excludeIds?: number[];
}

export default function MusicBrowser({
  defaultQuery = "",
  onSelect,
  selectedId,
  minDuration = 20,
  maxDuration = 600,
  autoPick = false,
  excludeIds = [],
}: MusicBrowserProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [tracks, setTracks] = useState<PixabayTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-search on mount with the AI's suggestion.
  useEffect(() => {
    if (defaultQuery) doSearch(defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(q: string, isRetry = false) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/music/search", window.location.origin);
      url.searchParams.set("q", q);
      url.searchParams.set("min_duration", String(minDuration));
      url.searchParams.set("max_duration", String(maxDuration));
      const r = await fetch(url.toString());
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Search failed (${r.status})`);
      const found = data.tracks || [];
      // Auto-broaden if first attempt is empty: drop everything after the
      // first space-separated word and try again. Most AI queries are too
      // specific (e.g. "modern uplifting electronic 120 bpm") — broader
      // queries return way more matches.
      if (found.length === 0 && !isRetry) {
        const firstWord = q.trim().split(/\s+/)[0];
        if (firstWord && firstWord.length >= 3 && firstWord.toLowerCase() !== q.toLowerCase()) {
          return await doSearch(firstWord, true);
        }
      }
      setTracks(found);
      if (autoPick && !selectedId && found.length > 0) {
        // Skip any track already in use by another platform, then pick a
        // RANDOM track from the top 4 candidates. Randomizing within results
        // means two renders never produce the exact same music, even if the
        // user just clicks 'Render preview' twice on the same platform.
        const candidates = found.filter((t: PixabayTrack) => !excludeIds.includes(t.id)).slice(0, 4);
        const pool = candidates.length > 0 ? candidates : found.slice(0, 4);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        selectTrack(pick).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function togglePlay(track: PixabayTrack) {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(track.previewUrl);
    a.onended = () => setPlayingId(null);
    a.onerror = () => { setPlayingId(null); setError("Couldn't play preview."); };
    a.play().catch(() => setError("Browser blocked autoplay — click again."));
    audioRef.current = a;
    setPlayingId(track.id);
  }

  async function selectTrack(track: PixabayTrack) {
    setSelectingId(track.id);
    setError(null);
    try {
      const r = await fetch(track.audioUrl);
      if (!r.ok) throw new Error(`Download failed (${r.status})`);
      const blob = await r.blob();
      // Stop any current preview audio
      audioRef.current?.pause();
      setPlayingId(null);
      onSelect(track, blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load track");
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); doSearch(query); }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="cinematic warm strings, lo-fi house, atmospheric..."
            className="w-full rounded-lg border border-border bg-bg-deep/40 pl-8 pr-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-mint/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-mint/90 px-3 py-2 text-sm font-medium text-black hover:bg-mint disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {tracks.length === 0 && !loading && !error && (
        <div className="rounded-lg border border-border/60 bg-bg-deep/30 px-3 py-6 text-center text-xs text-muted">
          <Music className="mx-auto mb-1 h-4 w-4 opacity-60" />
          Search above to find royalty-free tracks. Free for any use, including commercial.
        </div>
      )}

      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {tracks.map((t) => {
          const isSelected = selectedId === t.id;
          const isPlaying = playingId === t.id;
          const isLoading = selectingId === t.id;
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 transition ${
                isSelected
                  ? "border-mint/60 bg-mint/10"
                  : "border-border/60 bg-bg-deep/40 hover:border-border-strong"
              }`}
            >
              <button
                type="button"
                onClick={() => togglePlay(t)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text hover:bg-bg-deep"
                aria-label={isPlaying ? "Pause" : "Play preview"}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text">{t.title}</div>
                <div className="text-[11px] text-muted">
                  {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")} · by {t.creator}
                  <a
                    href={t.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center text-mint/70 hover:text-mint"
                    aria-label="Pixabay page"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectTrack(t)}
                disabled={isLoading || isSelected}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  isSelected
                    ? "bg-mint text-black cursor-default"
                    : "bg-mint/80 text-black hover:bg-mint disabled:opacity-50"
                }`}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isSelected ? <><Check className="inline h-3 w-3 mr-0.5" /> In use</> : "Use"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
