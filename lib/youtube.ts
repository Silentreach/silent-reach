import { YoutubeTranscript } from "youtube-transcript";
import { parseIsoDuration } from "./utils";
import type { VideoMeta } from "@/types";

export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Raw ID (11 chars of allowed alphabet)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split(/[/?]/)[0] || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1]) return parts[1];
      if (parts[0] === "embed" && parts[1]) return parts[1];
      if (parts[0] === "v" && parts[1]) return parts[1];
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`YouTube API returned ${resp.status}: ${await resp.text()}`);
  }
  const data = (await resp.json()) as {
    items?: Array<{
      snippet: {
        title: string;
        description: string;
        tags?: string[];
        publishedAt: string;
        channelTitle: string;
      };
      contentDetails: { duration: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) throw new Error("Video not found or private");
  const durationSeconds = parseIsoDuration(item.contentDetails.duration);
  return {
    videoId,
    title: item.snippet.title,
    description: item.snippet.description || "",
    tags: item.snippet.tags || [],
    duration: item.contentDetails.duration,
    durationSeconds,
    publishedAt: item.snippet.publishedAt,
    channelTitle: item.snippet.channelTitle,
  };
}

export async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) {
      throw new Error("No captions available on this video");
    }
    return segments
      .map((s) => {
        const sec = Math.floor(s.offset / 1000);
        const mm = Math.floor(sec / 60).toString().padStart(1, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `[${mm}:${ss}] ${s.text}`;
      })
      .join("\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown transcript error";
    throw new Error(`Transcript fetch failed: ${msg}`);
  }
}
