"use client";

/* Per-frame analysis used to bias the 9:16 crop toward the actual subject
   instead of brain-dead center-crop. Two signals stacked:

   1. Brightness center-of-mass: overweights bright regions (which is where
      the eye lands in a typical exposure-balanced video frame).
   2. Motion concentration: in moving shots, the subject is usually where
      the most pixel change is. We have motion-delta per FRAME already (Day 1)
      but motion within a frame requires comparing this frame to the next.

   For now we use brightness COM with edge-falloff weighting (penalize
   pixels near the frame edge — they're probably background or vignette).
   That gets us 80% of the way there without a second pass. We can add
   motion COM in a future iteration. */

export interface SubjectZone {
  /** Horizontal center of the subject as 0-1 of frame width */
  centerX: number;
  /** Vertical center of the subject as 0-1 of frame height */
  centerY: number;
  /** 0-1 — higher = clearer subject. Below 0.3 = no obvious subject, fall back to center crop. */
  confidence: number;
}

const FALLBACK: SubjectZone = { centerX: 0.5, centerY: 0.5, confidence: 0 };

/* Compute subject zone from a JPEG/PNG data URL. Async because we draw to
   an offscreen canvas. Designed to run during frame extraction (Day 1)
   so the render path doesn't pay any cost. */
export async function computeSubjectZone(dataUrl: string): Promise<SubjectZone> {
  if (typeof document === "undefined") return FALLBACK;
  try {
    const img = await loadImage(dataUrl);
    const W = 64; // tiny — this is purely for COM, not display
    const H = Math.round((img.naturalHeight / img.naturalWidth) * W);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d", { willReadFrequently: true });
    if (!cx) return FALLBACK;
    cx.drawImage(img, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data;

    let sumX = 0, sumY = 0, sumW = 0, totalLum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        // Edge falloff: pixels near the frame edge weighted less.
        const ex = Math.abs(x - W / 2) / (W / 2);
        const ey = Math.abs(y - H / 2) / (H / 2);
        const edgeWeight = 1 - 0.5 * Math.max(ex, ey); // 1.0 center → 0.5 corners
        const w = lum * edgeWeight;
        sumX += x * w;
        sumY += y * w;
        sumW += w;
        totalLum += lum;
      }
    }
    if (sumW < 1) return FALLBACK;
    const meanLum = totalLum / (W * H);
    // Confidence: how far the brightness COM deviates from the frame center,
    // normalized. Bright frames with subject off-center → high confidence.
    const cmX = sumX / sumW / W;
    const cmY = sumY / sumW / H;
    const offsetMag = Math.hypot(cmX - 0.5, cmY - 0.5) * 2; // 0-1
    // Low-light frames are unreliable — penalize.
    const lumPenalty = meanLum < 40 ? 0.3 : 1.0;
    const confidence = Math.min(1, offsetMag * lumPenalty);
    return { centerX: cmX, centerY: cmY, confidence };
  } catch {
    return FALLBACK;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* Decide which transition fits between two frames based on motion deltas.
   Frame motion deltas are computed during extraction (Day 1) — values
   normalized 0-1. We pick:

   - "whip"      : both frames high motion (>0.6) → camera-move feel
   - "crossfade" : both frames similar low motion (<0.35) → match-cut feel
   - "dip"       : everything else, default (already what the renderer does)

   Returned transition is consumed by the renderer's drawTransition()
   to vary the cut feel across the reel. */

export type TransitionType = "dip" | "whip" | "crossfade";

export function inferTransition(
  prevMotion: number | undefined,
  nextMotion: number | undefined,
): TransitionType {
  if (typeof prevMotion !== "number" || typeof nextMotion !== "number") return "dip";
  if (prevMotion > 0.6 && nextMotion > 0.6) return "whip";
  if (prevMotion < 0.35 && nextMotion < 0.35 && Math.abs(prevMotion - nextMotion) < 0.15) return "crossfade";
  return "dip";
}
