import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractJson(text: string): unknown {
  // Strip markdown fences if present
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) cleaned = fenced[1].trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Fallback: find the first { and last } and try that substring
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {}
  }
  throw new Error("Model did not return valid JSON");
}

export function newId() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

export function parseIsoDuration(iso: string): number {
  // ISO 8601 duration like PT1H2M3S → seconds
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    (parseInt(d || "0") * 86400) +
    (parseInt(h || "0") * 3600) +
    (parseInt(min || "0") * 60) +
    parseInt(s || "0")
  );
}
