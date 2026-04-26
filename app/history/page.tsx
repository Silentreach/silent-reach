"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Search, X } from "lucide-react";
import BriefResult from "@/components/BriefResult";
import PackResult from "@/components/PackResult";
import {
  clearHistory,
  getHistory,
  removeFromHistory,
} from "@/lib/storage";
import OutcomeCapture from "@/components/OutcomeCapture";
import type { HistoryItem } from "@/types";

/* Build a searchable text blob for an item: title + first 200 chars of body. */
function searchableText(item: HistoryItem): string {
  if (item.kind === "brief") {
    const o = item.output;
    return [
      item.input.concept,
      o.pitch,
      ...o.hooks.map((h) => h.line),
      ...o.titleOptions,
      o.thumbnailDirection?.overlayText || "",
    ]
      .join(" ")
      .toLowerCase()
      .slice(0, 800);
  } else {
    const o = item.output;
    return [
      item.meta.title,
      o.instagramCaption,
      o.linkedInPost,
      ...o.titleVariants,
    ]
      .join(" ")
      .toLowerCase()
      .slice(0, 800);
  }
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(getHistory());
  }, []);

  // Keyboard "/" focuses the search box (skip when typing in another input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => searchableText(it).includes(q));
  }, [items, query]);

  function remove(id: string) {
    removeFromHistory(id);
    setItems(getHistory());
    if (openId === id) setOpenId(null);
  }

  function clearAll() {
    if (!confirm("Clear all history? This can't be undone.")) return;
    clearHistory();
    setItems([]);
    setOpenId(null);
  }

  const open = filtered.find((i) => i.id === openId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="mt-1 text-sm text-muted">
            Last 20 briefs and packs. Stored locally in your browser.
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:border-red-700 hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </header>

      {/* Search */}
      {items.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hooks, captions, titles, concepts…  ( / to focus)"
            className="!pl-9 !pr-9"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {query && (
            <div className="mt-2 text-[11px] text-muted">
              {filtered.length} of {items.length} matching
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Nothing saved yet. Generate a brief or pack to see it here.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Nothing matches &ldquo;{query}&rdquo;. Try a shorter query or clear the search.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const title =
              item.kind === "brief" ? item.input.concept : item.meta.title;
            const isOpen = openId === item.id;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          (item.kind === "brief"
                            ? "bg-gold/10 text-gold"
                            : "bg-blue-500/10 text-blue-300")
                        }
                      >
                        {item.kind === "brief" ? "Brief" : "Pack"}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {title}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </button>
                  <div onClick={(e) => e.stopPropagation()}>
                    <OutcomeCapture itemId={item.id} itemKind={item.kind} variant="compact" />
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="rounded-md p-2 text-muted hover:bg-red-950/30 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && open && open.id === item.id && (
                  <div className="border-t border-border p-5">
                    {open.kind === "brief" ? (
                      <BriefResult output={open.output} />
                    ) : (
                      <PackResult meta={open.meta} pack={open.output} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
