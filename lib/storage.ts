import type { HistoryItem } from "@/types";

const KEY = "silentreach_history";
const MAX = 20;

function isClient() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getHistory(): HistoryItem[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: HistoryItem): void {
  if (!isClient()) return;
  const current = getHistory();
  const next = [item, ...current].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeFromHistory(id: string): void {
  if (!isClient()) return;
  const next = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  if (!isClient()) return;
  localStorage.removeItem(KEY);
}
