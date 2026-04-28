"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Check, Upload, Trash2, Lightbulb } from "lucide-react";
import { Loader2 } from "lucide-react";
import { getBrandKit, setBrandKit, type BrandKit } from "@/lib/db/brandKit";

const SWATCHES = ["#d4af37", "#ffffff", "#0a0a0a", "#e8c764", "#f5efe7", "#1c1c1c"];

export default function BrandKitPage() {
  const [kit, setKit] = useState<BrandKit>({});
  const [loaded, setLoaded] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setKit(await getBrandKit());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load brand kit");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = (k: keyof BrandKit, v: string | undefined) =>
    setKit((prev) => ({ ...prev, [k]: v }));

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200 * 1024) {
      alert("Logo file is over 200KB. Compress or pick a smaller image — large logos slow Mintflow down.");
      return;
    }
    const r = new FileReader();
    r.onload = (e) => update("logoDataUrl", String(e.target?.result ?? ""));
    r.readAsDataURL(file);
  };

  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setBrandKit(kit);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return (
    <div className="flex items-center gap-2 text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading your brand kit…
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Identity */}
      <section className="space-y-4">
        <header>
          <h2 className="font-display text-2xl tracking-tight">Identity</h2>
          <p className="mt-1 text-sm text-muted">Used in thumbnail captions and as a sign-off in generated content.</p>
        </header>
        <Field label="Brand name">
          <input
            type="text"
            value={kit.name || ""}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Silent Story"
          />
        </Field>
        <Field label="Tagline (optional)">
          <input
            type="text"
            value={kit.tagline || ""}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="Real estate video, Victoria BC"
          />
        </Field>
      </section>

      {/* Colors */}
      <section className="space-y-4">
        <header>
          <h2 className="font-display text-2xl tracking-tight">Colors</h2>
          <p className="mt-1 text-sm text-muted">
            Two hex colors. Used as the default palette for thumbnail presets and Claude&apos;s thumbnail recommendations.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label="Primary"
            value={kit.primaryColor || "#d4af37"}
            onChange={(v) => update("primaryColor", v)}
          />
          <ColorField
            label="Secondary"
            value={kit.secondaryColor || "#ffffff"}
            onChange={(v) => update("secondaryColor", v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">Quick set primary:</span>
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => update("primaryColor", c)}
              className="h-6 w-6 rounded-full border border-border-strong"
              style={{ background: c }}
              aria-label={`Set primary to ${c}`}
              title={c}
            />
          ))}
        </div>
      </section>

      {/* Logo */}
      <section className="space-y-3">
        <header>
          <h2 className="font-display text-2xl tracking-tight">Logo (optional)</h2>
          <p className="mt-1 text-sm text-muted">
            Small PNG/SVG, ideally on a transparent background. Used as a corner mark on Pro thumbnails. Max 200 KB.
          </p>
        </header>

        <div className="flex items-center gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-bg-deep transition hover:border-gold/60"
          >
            {kit.logoDataUrl ? (
              <img src={kit.logoDataUrl} alt="" className="max-h-16 max-w-16 object-contain" />
            ) : (
              <Upload className="h-5 w-5 text-muted" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs text-text transition hover:border-gold/60 hover:text-gold"
            >
              <Upload className="h-3 w-3" /> {kit.logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
            {kit.logoDataUrl && (
              <button
                onClick={() => update("logoDataUrl", undefined)}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onLogoFile(e.target.files?.[0])}
          />
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-between border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Lightbulb className="h-3.5 w-3.5 text-gold/70" />
          Stored on your account — visible to everyone in your org.
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-rose-300">{error}</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold-light disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedTick ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : savedTick ? "Saved" : "Save brand kit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-widest text-muted">{label}</div>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-widest text-muted">{label}</div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg p-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="!h-8 !w-10 cursor-pointer rounded-md border-0 !p-0"
          style={{ background: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          className="!border-0 !bg-transparent !p-0 font-mono text-sm uppercase"
          style={{ outline: "none" }}
        />
      </div>
    </div>
  );
}
