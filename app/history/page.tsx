"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import BriefResult from "@/components/BriefResult";
import PackResult from "@/components/PackResult";
import {
  clearHistory,
  getHistory,
  removeFromHistory,
} from "@/lib/storage";
import type { HistoryItem } from "@/types";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setItems(getHistory());
  }, []);

  function remove(id: string) {
    removeFromHistory(id);
    setItems(getHistory());
    if (openId === id) setOpenId(null);
  }

  function clearAll() {
    clearHistory();
    setItems([]);
    setOpenId(null);
  }

  const open = items.find((i) => i.id === openId);

  return (
    <div className="space-y-8">
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

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Nothing saved yet. Generate a brief or pack to see it here.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
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
