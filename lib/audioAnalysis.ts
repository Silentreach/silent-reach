"use client";

/* Audio analysis for Reel Multiplier — currently:
   - detectBPM: estimate the BPM of an uploaded music file
   - snapSegmentsToBeats: nudge cut transitions onto beat boundaries

   We use web-audio-beat-detector for BPM. It runs in the browser via
   Web Audio's AudioContext + AnalyserNode + a simple onset detector.
   For most modern music (60-180 BPM, steady tempo) it lands within
   ±2 BPM. Acoustic / live recordings can be off, so we treat low-
   confidence results as "skip beat-snapping" rather than forcing
   bad cuts. */

import { analyze } from "web-audio-beat-detector";

export interface Segment { startSec: number; endSec: number; }

export async function detectBPM(file: File): Promise<number | null> {
  if (typeof window === "undefined") return null;
  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext);
    const ctx = new Ctor();
    const arr = await file.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    // analyze takes the buffer and returns BPM as a number
    // Wrap in 5s race — analyze() can hang on weird audio
    const bpm = await Promise.race<number>([
      analyze(buf),
      new Promise<number>((_, rej) => setTimeout(() => rej(new Error("BPM detect timeout")), 5000)),
    ]);
    try { await ctx.close(); } catch {}
    if (!isFinite(bpm) || bpm < 50 || bpm > 220) return null;
    return Math.round(bpm * 10) / 10; // one decimal
  } catch {
    return null;
  }
}

/* Snap each cut transition onto the nearest beat boundary in OUTPUT time.
   Output time = cumulative duration of segments through this cut.
   We only snap when within `tolerance` seconds — otherwise the AI's
   intentional cut wins. Returns NEW segments (immutable). */
export function snapSegmentsToBeats(
  segments: Segment[],
  bpm: number | null,
  tolerance = 0.4,
): { adjusted: Segment[]; snapsApplied: number } {
  if (!bpm || bpm < 50 || bpm > 220 || segments.length === 0) {
    return { adjusted: segments, snapsApplied: 0 };
  }
  const beatInterval = 60 / bpm;
  const adjusted: Segment[] = [];
  let cumulativeOutput = 0;
  let snapsApplied = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segDur = Math.max(0.1, seg.endSec - seg.startSec);
    const targetEnd = cumulativeOutput + segDur;

    // Find nearest beat boundary
    const nearestBeatNum = Math.round(targetEnd / beatInterval);
    const snappedEnd = nearestBeatNum * beatInterval;
    const delta = snappedEnd - targetEnd;

    let newDur = segDur;
    if (Math.abs(delta) <= tolerance && snappedEnd > cumulativeOutput + 0.5) {
      newDur = segDur + delta;
      snapsApplied++;
    }
    adjusted.push({
      startSec: seg.startSec,
      endSec: seg.startSec + newDur,
    });
    cumulativeOutput += newDur;
  }
  return { adjusted, snapsApplied };
}
