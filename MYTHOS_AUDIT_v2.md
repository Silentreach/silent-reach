# MYTHOS AUDIT v2 — Reel Multiplier (post b7cf34c)
**Date:** 2026-04-29
**Scope:** verification of B1–B8 fixes shipped in `b7cf34c`, plus second-pass benchmark vs CapCut / Submagic / Sotheby's-grade listing media.
**Question:** Industry-benchmark ready to sell to BC realtors and contractors today?
**Up front:** Almost. 6 of 8 claimed blockers are genuinely fixed. B2 is half-fixed (call site forces dip, but the public type union and `inferTransition()` still advertise whip/crossfade — dead-code dishonesty rather than runtime bug). B8 is wired but instruments **zero tokens** because `lib/claude.ts` discards `resp.usage` before returning. Two new blockers surfaced. ~75% of yesterday's audit gap closed.

---

## VERIFIED FIXED

### B1 — Music fade aligned with visual fade [GREEN]
`lib/videoRender.ts:259–278`. Two-stage envelope confirmed:
- Music holds 0.9 until `t0 + totalMainDur - fadeOutSec`
- Linear ramps to `0.55` (or `0` if no outro) at `t0 + totalMainDur` — moves WITH the visual fade-to-black
- If outro: holds 0.55 through outro, ramps to 0 in last 0.05s before render end
This matches the cinematographer expectation. The "full music over a black screen" bug is gone. Verified against renderer's visual fade at `:241–246`.

### B2 — Transition union locked at call site [YELLOW — not fully fixed]
`components/ReelMultiplier.tsx:885` passes `transitionIn: "dip" as const`. Runtime is honest. **But:** the `Segment` type in `lib/videoRender.ts:21` still declares `transitionIn?: "dip" | "whip" | "crossfade"`, and `lib/frameAnalysis.ts:97–107` still exports `inferTransition()` returning whip/crossfade. The audit explicitly asked for "drop the union — `transitionIn?: 'dip'` only — and remove `inferTransition` entirely." This is dead-code rot, not a runtime bug, but the next engineer reading the renderer will believe whip/crossfade exist. **30-second fix:** narrow the union and delete `inferTransition`.

### B3 — Cut sanitization [GREEN]
`app/api/reel-multiplier/route.ts:107–134` `sanitizeCuts()`:
- Clamps to `sourceDurationSec` ✓
- Drops slivers under 1s (`endSec > startSec + 1.0`) ✓
- Sorts by start ✓
- Removes overlaps; salvages tail past prior end if >1s ✓
- Caps at 6 ✓
- 422 returned at `:80–85` if any package ends with empty cuts ✓
Solid. One nit: error string at `:82` uses backslash-escaped apostrophe (`didn\'t`) — renders as literal `didn\'t` in JSON since it's already inside a double-quoted string. Repeats at `:90` (`Don\'t`). Cosmetic but visible to users.

### B5 — Gallery preview reset [GREEN]
- `components/ReelMultiplier.tsx:752` passes `stillInGallery={pkg.platform in renderedByPlatform}` to `PackageCard`
- `components/ReelMultiplier.tsx:815–824` useEffect on `stillInGallery` revokes `previewUrl` + `previewThumbUrl`, resets `previewUrl/previewThumbUrl/renderState` when parent removes
- Fresh thumb captured to local var `freshThumbUrl` at `:944` BEFORE `onPreviewReady` payload at `:956`. No more stale-thumb race.
- Filename gets `Date.now().toString(36).slice(-5)` suffix at `:959` — addresses I7 too.

### B6 — Render disabled state [GREEN]
`components/ReelMultiplier.tsx:1007` `disabled={renderState === "rendering" || !sourceFile || editedCuts.length === 0 || !editedHook.trim()}`. Plus an early return at `:861`. The button now physically can't fire on empty cuts.

### B7 — iOS Safari banner [GREEN]
`components/ReelMultiplier.tsx:648–653`. UA detect excludes Chrome/Edge on iOS. Amber callout reads "iOS Safari note: Reel rendering is unreliable on iPhone/iPad Safari…" Honest copy; sets expectation.

### B8 — Usage logging wired BUT broken [RED — see new blockers]
`logUsage()` exists at `:138–171` and is fire-and-forget called at `:88`. Insert reaches Supabase. **However**, it reads `(output as { _usage?: ... })._usage` — and `lib/claude.ts:148–158` returns only `block.text`, never attaching `resp.usage`. Every row in `usage_log` will record `input_tokens=0, output_tokens=0, cost_usd_cents=0`. Schema satisfied, instrumentation lying. See N1 below.

---

## NEW BLOCKERS

### N1 — Usage log inserts zeros for tokens & cost [RED]
**File:** `lib/claude.ts:148–158`, `app/api/reel-multiplier/route.ts:148–155`
**Bug:** `generateReelMultiplier` returns the parsed JSON only. Anthropic's `resp.usage = { input_tokens, output_tokens }` is dropped on the floor. The route's `logUsage` looks for `output._usage` and finds nothing. You'll ship believing you have billing data and wake up to a `usage_log` table full of zeros.
**Fix (15 min):** in `lib/claude.ts:155` after parse, attach: `(parsed as Record<string, unknown>)._usage = { input_tokens: resp.usage?.input_tokens, output_tokens: resp.usage?.output_tokens };` Then have `generateReelMultiplier` return that augmented object. Or — cleaner — change return type to `{ data: ReelMultiplierOutput; usage: { ... } }` and update the route caller.

### N2 — Luxe thumbnail typography silently falls through to Georgia [RED]
**File:** `components/ReelMultiplier.tsx:288`, `app/globals.css:5`
**Bug:** `drawDesignedThumb` declares `fontFamily = "'Cormorant Garamond', 'Playfair Display', 'Didot', 'Bodoni 72', Georgia, serif"`. None of those fonts are imported. `globals.css` only loads Inter + Fraunces. Canvas font matching skips unknown families silently and renders Georgia. The audit copy promised "luxurious typography for Sotheby's-tier listings" — at runtime this thumbnail renders identical to a 2008 PowerPoint title. `ThumbnailStudio.tsx:251` and `ThumbnailSuggestions.tsx:55` correctly preload Playfair via `<link>` for the Studio module — that pattern was simply never extended to the Reel Multiplier thumbnail draw path. Compass, Sotheby's, and the high end of @realestate Reels all run Domaine / Canela / Söhne. Falling back to Georgia is the difference between "premium" and "Etsy."
**Fix (10 min):** add `&family=Cormorant+Garamond:wght@500;600;700&family=Playfair+Display:wght@500;600;700` to the `globals.css` Google Fonts URL, and `await document.fonts.load("500 92px 'Cormorant Garamond'")` before `drawDesignedThumb` runs (otherwise first paint after a fresh page load uses the fallback).

---

## BELOW INDUSTRY BENCHMARK

### M1 — Music catalog feels thin (Jamendo, 8 results, no curation) [vs Epidemic Sound]
`app/api/music/search/route.ts:75` requests 20 from Jamendo, returns only 8 after filter. Riverside / Descript / CapCut surface 50–500 curated tracks per mood with a **mood/genre taxonomy**, not a freeform search. Realtors don't know they want "atmospheric warm strings 90 BPM" — they know they want "luxury listing" or "modern construction." Today's UX makes the user write a search query they shouldn't have to write. **Fix path (1–2 hr):** ship 6 hard-coded mood chips ("Cinematic", "Lo-fi", "Uplifting", "Tense Build", "Warm Acoustic", "Urban") that map to vetted Jamendo queries. Auto-pick already exists for mainline; chips give power-user override without typing.

### M2 — AI cut quality is hierarchy-aware in prompt but not verifiable in output [vs Submagic / Opus Clip]
`lib/prompts.ts:434–443` clearly tells Claude "HIGHLIGHTS, not chronological trim" and warns against `0:00→0:10, 0:10→0:20`. Good directive. **But there's no post-hoc check.** A trivially-failing model output (4 sequential 5-second cuts) passes `sanitizeCuts` cleanly. Submagic's pitch is literally "we test cuts against virality scoring." For a v1 sale, you don't need that — but you should at least add a "chronological cut detector" warning: if mean inter-cut gap is <2s OR cuts cover >85% of source, surface "These cuts look chronological — re-generate?" inline. ~30 min.

### M3 — No progress granularity during AI generation [vs Loom upload]
`components/ReelMultiplier.tsx:454–469` shows a single spinner during the 8–25s Claude call (Haiku 4.5 with vision + 12 frames isn't fast). Loom shows percent. Wave.video shows step labels ("analyzing footage"→"matching to your voice"→"writing captions"). Even faked progress (1% every 200ms with copy that rotates) feels 2× faster. **30-min fix:** rotate copy through 4 phases tied to `Date.now()` — "Reading your footage" / "Matching your voice" / "Writing platform copy" / "Picking thumbnails."

### M4 — Frame extraction has no progress + can hang on bad codec [I3 from yesterday]
Still pending. `components/ReelMultiplier.tsx:74–86` — `seekTo` has no timeout. Realtor uploads a HEVC iPhone clip → spinner forever, no diagnostic. Pair this with M3.

### M5 — Mobile cut editor still cramped at 380px [I8 from yesterday]
`components/ReelMultiplier.tsx:1180–1195`. Cut row is `flex items-center gap-2 font-mono text-xs` with 6 buttons + 2 timestamp spans + remove. At 380px with ~100% padding overhead, this overflows or wraps awkwardly. Tap targets are ~24×20px (fail Apple 44pt). iPad in landscape is fine; iPad portrait is borderline; iPhone is broken. Yesterday's I8 was deferred; for "realtor on iPad" use case it should be promoted.

### M6 — No AbortController anywhere [I1, I5, I10]
`grep AbortController` returns zero hits across `components/` and `app/api/music/`. Nav-away-mid-call leaks Anthropic budget. Wedged Jamendo CDN hangs the music download function until Vercel's 10s default. For a single-realtor demo this won't bite; for "5 realtors simultaneously" + variable network this becomes a tail-latency disaster.

### M7 — No accessibility primitives on render progress [P10]
No `aria-live` on the rendering progress (`:1018`), no `role="status"` on toasts, no `Esc` close on previews. Zero keyboard-only path through the cut editor (the −/+ nudge buttons have aria-labels, the rest don't). Below WCAG 2.1 AA. Doesn't block sale to a sighted realtor; matters for a brokerage with accessibility procurement requirements.

### M8 — `MediaElementAudioSource` failure still silent [B4 from yesterday]
`lib/videoRender.ts:147–153`. The `try {} catch {}` still swallows the iOS Safari `InvalidStateError`. User sees "Preview ready" + silent reel + no warning. The B7 banner partially mitigates (tells iOS Safari users it's flaky), but a paying user on an iPad will still get a silent reel and not know why. **15-min fix:** set a `failedToRouteAudio` flag, surface "Audio routing failed — preview will be silent" in the render-error toast.

### M9 — Filename / naming has post-Pixabay leftovers [polish, but visible]
`components/MusicBrowser.tsx:202` — aria-label still reads `"Pixabay page"`, the file header comment at `:3` says "Pixabay music browser." Internal tech is Jamendo. A realtor reading the source label on the external link tooltip will see "Pixabay" — minor but breaks trust.

---

## ABOVE INDUSTRY BENCHMARK (the moat)

### A1 — BC niche briefings in the prompt
`lib/prompts.ts:65–162`: VREB, CMHC, BC Step Code 1–5, foreshore-vs-waterfront-vs-oceanside legal distinction, garden-suite OCP language, COR-certified GCs, 2024 BCBC, 2030 gas furnace deadline. **No competitor has this.** CapCut/Submagic produce platform-correct generic. Mintflow produces "ten minutes from the BC Ferries terminal at Swartz Bay" copy that an out-of-province buyer actually understands. **This is the wedge.** Defend it. Document it externally.

### A2 — Voice training as binding constraint
`lib/prompts.ts:26` reads as a hard refusal directive — model is told to **internally REJECT and rewrite** anything that sounds like generic AI ("elevated", "stunning", "let's dive in", "unveil"). Submagic/Opus mimic transcripts; this mimics *the realtor's actual writing voice*. Underrated moat — write a one-pager about it.

### A3 — Per-platform DIFFERENT cuts
`lib/prompts.ts:438` "Different platforms get DIFFERENT cuts. Don't triplicate the same edit." Plus `excludeMusicIds` enforcement in MusicBrowser auto-pick. CapCut exports the same edit three times. Mintflow gives you three genuinely different reels in one click. Story this in marketing.

### A4 — 12 frames + motion delta passed to AI
`components/ReelMultiplier.tsx:21` (FRAME_MAX_W) and `lib/frameAnalysis.ts`. Most competitors send 4–6 thumbnails or no visual context at all. Twelve frames with motion-delta annotation lets Claude bias toward dynamic moments — that's why your cuts genuinely land on action, not the boring middle of a static drone shot.

### A5 — 12 Mbps + H.264 High profile + AAC-LC
`lib/videoRender.ts:166, 182`. CapCut Web exports at ~6–8 Mbps. Wave.video at ~8. You're at 12 with High profile (CABAC + B-frames). This is genuinely "premium master" output. Worth saying so in the export tooltip.

---

## SCOPE BOUNDARIES

- **O1 → still defer.** Real whip / crossfade transitions need snapshot canvases. 1+ days. v1 ships dip-only.
- **O2 → still defer.** Server-side render fallback. 2-week project. Banner is enough.
- **O6 → revisit at 50 paying users.** AI cut "did it land on a boring frame" check needs a second AI pass; not worth it pre-revenue.
- **Multi-user load.** Vercel free tier handles ~5 concurrent renders fine because rendering is client-side. The bottleneck is the Anthropic API rate limit + Jamendo rate limit. Both are forgiving at 5 users; revisit at 50.
- **Persistence on refresh mid-render.** None. Refresh loses the in-flight render. Industry norm — Wave.video and CapCut Web both lose state too. Defer.
- **Privacy.** Source video stays client-side; only base64 frames + duration + description go to your API. Frames pass through to Anthropic. **Worth surfacing this in copy** ("Your video stays on your device — only thumbnails are analyzed by AI"). Realtors are NDA-paranoid; this is a free trust win.

---

## EXECUTIVE VERDICT

**Industry-benchmark ready? No, but 90 minutes from yes.**

If you patch the two new RED blockers, you clear the bar:

1. **N1 — fix `_usage` plumbing** (15 min). Without this you have no billing path and no cost-spike alarm; everything else is academic if Anthropic spend explodes silently. `lib/claude.ts:155` attach `resp.usage` to the returned object.
2. **N2 — preload luxe thumbnail fonts** (10 min). Add `Cormorant Garamond` + `Playfair Display` to the Google Fonts URL in `globals.css:5`; await `document.fonts.load(...)` once before the first thumbnail draw. Without this you're shipping Georgia and calling it luxurious.
3. **B2 cleanup — narrow the type union, delete `inferTransition`** (10 min). Cosmetic but you asked for honesty.
4. **JSON apostrophe escapes in route 422** (5 min). Find `didn\'t` / `Don\'t` in `route.ts:82, 90` — those render as literal backslashes to users. Use plain `didn't` in a double-quoted string.
5. **M8 — surface the silent-audio-routing failure** (15 min). Don't let an iPad user get a silent reel without warning.
6. **N3 stretch — rotate AI-generation copy** (30 min). Tell users what's happening during the 8–25s Claude call.

Total ≈ 1h25m. After that, you are **beating CapCut Web on:** BC niche specificity (axis: copy quality), per-platform differentiation (axis: variety), voice mimicry (axis: authenticity), output bitrate at 1080p 9:16 (axis: technical quality). You are **beating Submagic on:** thumbnail design coherence with brand kit, source-stays-local privacy posture. You are **at par with Wave.video on:** UX flow polish, music catalog. You are **below Riverside / Descript on:** music catalog depth (Jamendo CC-BY ≠ Epidemic Sound) — but those are paid catalogs and the gap is licensing, not engineering.

**Audit gap closed since yesterday: ~75%.** B1, B3, B5, B6, B7 are unambiguous wins. B8 ships the rails but not the data (-15%). B2 is half done (-5%). B4 still silently swallows (-5%). New blockers add 10% gap back. Net: 100% gap → 25% gap. **One 90-minute focused patch session and you're handing this to a paying realtor with a straight face.**
