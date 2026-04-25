"use client";

export type LibraryItemKind = "hook" | "title" | "caption";

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  text: string;
  source?: string;       // free-form note, e.g. "Brief: Oak Bay reno"
  tags?: string[];       // user-added tags
  savedAt: number;       // epoch ms
}

const KEY = "mintflow_library";
const MAX = 200;

function read(): LibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(items: LibraryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export function getLibrary(): LibraryItem[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

export function isSaved(text: string, kind: LibraryItemKind): boolean {
  return read().some((i) => i.kind === kind && i.text === text);
}

export function toggleSaved(item: Omit<LibraryItem, "id" | "savedAt">): boolean {
  const items = read();
  const existing = items.find((i) => i.kind === item.kind && i.text === item.text);
  if (existing) {
    write(items.filter((i) => i.id !== existing.id));
    return false; // now removed
  }
  const id = Math.random().toString(36).slice(2, 11);
  write([{ id, savedAt: Date.now(), ...item }, ...items]);
  return true; // now saved
}

export function removeFromLibrary(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearLibrary() {
  write([]);
}
