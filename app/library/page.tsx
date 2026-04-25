"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Search, X, Bookmark, Quote, Type, Send } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import { getLibrary, removeFromLibrary, clearLibrary, type LibraryItem, type LibraryItemKind } from "@/lib/library";

const KIND_META: Record<LibraryItemKind, { label: string; icon: typeof Quote; color: string }> = {
  hook:    { label: "Hook",    icon: Quote, color: "bg-gold/10 text-gold" },
  title:   { label: "Title",   icon: Type,  color: "bg-blue-500/10 text-blue-300" },
  caption: { label: "Caption", icon: Send,  color: "bg-purple-500/10 text-purple-300" },
};

const FILTERS: Array<{ key: "all" | LibraryItemKind; label: string }> = [
  { key: "all",     label: "All" },
  { key: "hook",    label: "Hooks" },
  { key: "title",   label: "Titles" },
  { key: "caption", label: "Captions" },
];

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | LibraryItemKind>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setItems(getLibrary()); }, []);

  // "/" focuses search
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
    return items
      .filter((i) => filter === "all" || i.kind === filter)
      .filter((i) => !q || i.text.toLowerCase().includes(q) || (i.source || "").toLowerCase().includes(q));
  }, [items, filter, query]);

  const remove = (id: string) => {
    removeFromLibrary(id);
    setItems(getLibrary());
  };

  const clearAll = () => {
    if (!confirm("Clear your entire library? This can't be undone.")) return;
    clearLibrary();
    setItems([]);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2.5">
            <Bookmark className="h-5 w-5 text-gold" />
            Library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Hooks, titles, and captions you saved for re-use. Stored locally in your browser.
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

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Search + filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your library… ( / to focus)"
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
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const count = f.key === "all" ? items.length : items.filter((i) => i.kind === f.key).length;
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border text-muted hover:border-border-strong hover:text-text",
                    ].join(" ")}
                  >
                    {f.label}
                    <span className="text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
              No matches for these filters.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((it) => {
                const meta = KIND_META[it.kind];
                const Icon = meta.icon;
                return (
                  <li key={it.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <span className={`rounded px-2 py-0.5 ${meta.color}`}>
                            <Icon className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                            {meta.label}
                          </span>
                          <span className="text-muted">{new Date(it.savedAt).toLocaleDateString()}</span>
                          {it.source && <span className="text-muted">· {it.source}</span>}
                        </div>
                        <div className="mt-2 text-[15px] text-text/90">{it.text}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <CopyButton text={it.text} />
                        <button
                          onClick={() => remove(it.id)}
                          className="rounded-md p-2 text-muted hover:bg-red-950/30 hover:text-red-300"
                          aria-label="Remove from library"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <Bookmark className="mx-auto h-6 w-6 text-gold/60" />
      <h2 className="mt-3 font-display text-xl tracking-tight">Your library is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Click the bookmark icon next to any hook, title, or caption Mintflow generates.
        Your best lines accumulate here so you can reach for them on the next reel — instead of starting from zero.
      </p>
    </div>
  );
}
