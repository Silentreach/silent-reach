# MYTHOS AUDIT — Reel Multiplier
**Date:** 2026-04-28
**Scope:** components/{ReelMultiplier,MusicBrowser}.tsx, lib/{videoRender,frameAnalysis,audioAnalysis,prompts}.ts, app/api/reel-multiplier/route.ts, app/api/music/{search,download/[id]}/route.ts
**Question:** Ready to put in front of a paying BC realtor today?
**Up front:** No. But you're 4–6 hours from yes. The pipeline mostly works; what'll burn you on first contact is a small set of correctness bugs and unhandled error paths, not architectural rot.

---

## 🔴 SHIP-BLOCKERS

### B1. Music fade misalignment when outro is enabled
**File:** `lib/videoRender.ts:265–268`
**Bug:** With outro on, `totalRenderDur = totalMain + outroDur`. Music holds at 0.9 until `totalRenderDur - 0.5s`, then fades. But the *visual* fade-to-black runs in the last `fadeOutSec=1.5s` of MAIN — well before the outro starts. Result: 1.5s of black-screen + full-volume music as the main phase ends. This is the bug the user reported earlier; it isn't fixed.
**Fix:** Two-stage envelope. Music fades with visuals at end of main: `setValueAtTime(0.9, t0 + totalMain - fadeOutSec); linearRampToValueAtTime(0.0, t0 + totalMain)`. Optionally hold silent through outro, or ramp music back to 0.6 by `t0 + totalMain + 0.4` and fade to 0 by `+ outroDur - 0.05`.

### B2. `transitionIn: "whip" | "crossfade"` is set but renderer only does dip-to-black
**File:** `lib/videoRender.ts:200–234`, `frameAnalysis.ts:99–107`
**Bug:** `inferTransition` returns whip/crossfade/dip, but the draw loop only honors `dip` (transOpacity rgba fill). The other transition values are silently ignored. Not a crash — just dishonest variety.
**Fix (cheap):** Drop the union — `transitionIn?: "dip"` only — and remove `inferTransition` entirely. Don't ship features the renderer doesn't implement. Implement real whip/crossfade in week 2.

### B3. AI `cutMarkers` not validated against source duration or non-overlap
**Files:** `app/api/reel-multiplier/route.ts:9–22`, `lib/claude.ts:248–252`
**Bug:** Zod accepts raw numbers — no `endSec > startSec`, no `endSec ≤ sourceDurationSec`, no overlap check, no array cap. Claude's been told "2–4 cuts" but on 3-min sources it sometimes returns cuts past the end (`startSec: 178, endSec: 195` on a 180s source) or duplicates. The renderer's `seekTo` clamps to `duration - 0.05`, so it doesn't crash — it just renders a held-still frame. Looks broken.
**Fix:** Post-parse in `route.ts`: drop segs where `endSec ≤ startSec`; clamp `endSec = Math.min(endSec, sourceDurationSec)`; drop segs <1s; sort by `startSec`; remove overlaps; cap at 6. If a package ends up with 0 cuts, return a 422 with a "try again" message.

### B4. `MediaElementAudioSource` re-render path silently produces silent reels
**File:** `lib/videoRender.ts:147–153`
**Bug:** The fallback that routes source-video audio through Web Audio is wrapped in a `try {} catch {}` that swallows errors silently. On Safari (especially iOS) re-rendering can throw `InvalidStateError`. User gets a "preview ready" with NO audio and no warning.
**Fix:** Don't swallow — set a `failedToRouteAudio` flag and either (a) throw a friendly error so the user knows, or (b) include the bare video.muted=false path with `volume=1` as a degraded fallback. Minimum: surface "audio routing failed" as a render-error toast.

### B5. Gallery shows stale thumbnail after re-render; revoked-URL download breaks local preview
**File:** `components/ReelMultiplier.tsx:911–938, 685`
**Bug A:** When `onRender` succeeds, it reads `previewThumbUrl` from React state to bubble up to the gallery — but that state was set seconds earlier (line 923) and on a re-render path uses the *previous* thumb. Gallery shows old thumb beside new reel.
**Bug B:** When the gallery X-button revokes `info.url` (line 685), the child PackageCard's local `previewUrl` still points to the now-revoked URL — clicking download from the local card silently fails.
**Fix:** (A) Capture `newThumbBlobUrl` in a local variable, pass it to both `setPreviewThumbUrl` and the `onPreviewReady` payload. (B) Lift removal to a callback prop so the child can null its `previewUrl` too, or `key={pkg.platform + renderCount}` to force-reset the card.

### B6. Render button does nothing when user deletes all cuts
**File:** `components/ReelMultiplier.tsx:840–841, 982–984`
**Bug:** `onRender` early-returns on `editedCuts.length === 0` with no error state. Button stays "Render preview". User clicks repeatedly, nothing happens. Refund.
**Fix:** Disable button on `editedCuts.length === 0 || !editedHook.trim()`. Show "Add at least one cut" inline.

### B7. iOS Safari renders silently broken — no detection, no fallback message
**File:** `lib/videoRender.ts:178`
**Bug:** `MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")` returns `true` on iOS Safari but actual recording produces partial / 0-byte files when combined with a `captureStream + AudioContext destination` chain. A realtor on iPad will get a corrupt download with zero diagnostic.
**Fix (cheapest):** UA-detect iOS Safari (not Chrome on iOS — `CriOS`), show a banner: "Reel rendering needs desktop Chrome, Safari 17+ on Mac, or Edge. iOS Safari rendering is unreliable." Honest, sets expectation, ships today.

### B8. Usage logging not wired up
**File:** `app/api/reel-multiplier/route.ts` (no insert); `supabase/schema.sql:104`
**Bug:** Schema defines `usage_log(org_id, feature, model, tokens, cost_usd_cents)` but the route never inserts. You cannot bill, rate-limit, show "12/30 reels this month", or detect Anthropic cost spikes.
**Fix:** After successful generation, fire-and-forget insert: `{ org_id, user_id, feature: 'reel_multiplier', model: 'claude-haiku-4-5', input_tokens, output_tokens }` from `response.usage`. Compute cents from your model price table.

### B9. No-org-row signed-in users silently lose voice training
**File:** `app/api/reel-multiplier/route.ts:60`
**Bug:** `getServerUserContext().catch(() => undefined)` swallows the error and falls back to body context (legacy localStorage). Post-migration users with orphan profiles get generic copy and never know why their voice training "stopped working".
**Fix:** Distinguish "no DB context" from "DB error". Log server-side. If user is authed but voice samples missing entirely, surface a one-time toast: "Voice training not loaded — finish setup at /settings/voice."

---

## 🟡 IMPORTANT (1–2 days)

### I1. No AbortController on the 60s Claude fetch
`components/ReelMultiplier.tsx:454–469`. Navigating away mid-call leaks the request, eats Anthropic budget, fires setState on unmounted. Add a useEffect-managed AbortController; abort on unmount and `reset()`.

### I2. Double-click race on Render button
`components/ReelMultiplier.tsx:982–984`. Disabled-check is on async-set state; sub-50ms window allows two MediaRecorders. Use a `useRef<boolean>` lock checked synchronously at the top of `onRender`.

### I3. Frame extraction has no per-seek timeout
`components/ReelMultiplier.tsx:74–86`. Corrupt MP4 / HEVC the browser can't decode hangs `onseeked` indefinitely. Wrap each seek in `Promise.race` with 8s timeout; throw "couldn't decode at Xs — re-export as H.264 MP4."

### I4. MusicBrowser audio not paused on unmount
`components/MusicBrowser.tsx:54`. Switching tabs while previewing leaves audio playing; setState fires on unmounted. Add `useEffect(() => () => audioRef.current?.pause(), [])`.

### I5. `selectTrack` has no timeout / abort
`components/MusicBrowser.tsx:118–134`. Slow Jamendo CDN hangs the "Use" spinner forever. Add AbortController + 15s timeout; ignore state writes after unmount via cancelled-ref.

### I6. Music search returns 0 → no clear next step
`components/MusicBrowser.tsx:79–84`. If the broaden retry also returns 0, user sees a generic empty state. Render proceeds with source audio with no warning. Add suggestion chips ("cinematic", "lofi") and surface "music collapsed — using source audio" in the parent.

### I7. Filename collisions across re-renders
`components/ReelMultiplier.tsx:892`. Same package = same filename. iOS overwrites silently. Append `_${Date.now().toString(36).slice(-5)}` before the extension.

### I8. Cut editor breaks at <380px viewport
`components/ReelMultiplier.tsx:1157–1172`. Row overflows horizontally with no scroll; "remove" clips off-screen. Tap targets are ~24×20px (fail Apple 44pt). Wrap rows + bump button heights to 36–40px on mobile.

### I9. Brand-color hex not validated
`lib/videoRender.ts:484`. Invalid hex silently renders the pill transparent. Validate `/^#[0-9a-f]{3,8}$/i` in BrandKit getter; fallback `#0a0a0a`.

### I10. Music download proxy has no fetch timeouts
`app/api/music/download/[id]/route.ts`. Two sequential fetches with no AbortSignal; wedged Jamendo CDN hangs the function until Vercel's 10s default. Add `AbortSignal.timeout(8000)` to both.

### I11. Hook line not capped in renderer
`components/ReelMultiplier.tsx:1186` clamps to 80 chars in the textarea — but if AI returns a long hook, the renderer wraps over 4+ lines and pushes into the safe area. In `drawAnimatedHook`, scale font down once if wrapped block >3 lines, or hard-truncate at 80 in renderer too.

### I12. BPM detection has no timeout / progress
`lib/audioAnalysis.ts:125–141`. `analyze(buf)` can take 1–8s, occasionally hang. Wrap in 5s `Promise.race`; show subtle "detecting BPM…" indicator. Already null-tolerant.

---

## 🟢 POLISH

- **P1.** Empty `<p>` placeholder under the render bar (`ReelMultiplier.tsx:955–957`) — delete or fill.
- **P2.** Dead code in `videoRender.ts`: `drawLogo` (666), `drawBrandText` (676), `drawLogoVideo` (767) — never called. Remove.
- **P3.** Dead components in `ReelMultiplier.tsx`: `FrameAt`, `ExtLink` (1384–1399). Remove.
- **P4.** `roundRect` polyfill — modern browsers ship `ctx.roundRect()` natively (Chrome 99+, Safari 16+).
- **P5.** `DesignedThumbPreview` re-runs on `reason` changes (1374) — `reason` doesn't affect the draw. Drop from deps.
- **P6.** `getBrandKit()` called inside `PackageCard` JSX (953) — runs every keystroke. Memoize with `useMemo`.
- **P7.** Hashtag duplicates not deduped — AI sometimes returns `["realestate", "#realestate"]`. Dedupe on lowercased no-`#`.
- **P8.** CC-BY attribution copy is buried in 10px text. Make the credit copy one-click-to-copy or part of post-publish flow.
- **P9.** Frame extraction shows single "Reading frames…" — show "4 of 12" or a progress bar; 6–15s feels longer without progress.
- **P10.** No `aria-live` on render progress; no Escape-to-close on previews. Add `role="status" aria-live="polite"` to render progress text.

---

## ➡️ OUT OF SCOPE (defer + reason)

- **O1. Real whip/crossfade transitions.** Requires snapshot canvases + alpha blend. 1+ days. Ship dip-only, remove the union (B2).
- **O2. Full iOS Safari support.** Needs server-side render fallback (FFmpeg on Vercel/worker). 2-week project. Banner + desktop recommendation is enough for v1; realtors edit on laptops.
- **O3. Voice-sample compression.** 20 samples × every prompt is expensive but premature to optimize.
- **O4. Cross-session reel persistence.** Fire-and-forget download is fine for v1.
- **O5. Meta in-app catalog parity.** Jamendo CC-BY ≠ Meta licensed; IG may mute. Surface the risk in copy ("if IG mutes, re-attach Meta's track on upload"); paid catalog (Epidemic) is a paid-tier feature.
- **O6. Deeper AI cut quality (does it land on a boring frame?).** Needs a second AI pass or much heavier heuristics. Defer past launch.

---

## Executive verdict

**No, not today.** B1 (music fade) is the bug a paying user catches in the first 30 seconds and calls amateur hour. B3 (unvalidated cuts) makes 1-in-10 reels look broken on long sources. B5 makes the gallery feel buggy on second render. B6 lets users wedge themselves with no recovery. B8 means you have no instrumentation to find the next problem and no path to bill. **Smallest ship-ready patch (4–6 hours):** (1) Re-schedule the music gain envelope to follow the visual fade (B1) — 30 min. (2) Validate + clamp + sort cutMarkers in the API route, cap at 6 (B3) — 45 min. (3) Disable the Render button when `editedCuts.length === 0` with an inline hint (B6) — 10 min. (4) Use a local var for the new thumb URL in the gallery payload, reset child preview state on gallery removal (B5) — 60 min. (5) Fire-and-forget `usage_log` insert with token counts from the Anthropic response (B8) — 30 min. (6) Add the iOS Safari "use desktop" banner (B7) — 15 min. (7) Surface the audio-routing-failed catch as a real error (B4) — 15 min. (8) Drop the dead transition union (B2) — 10 min. After that, you can hand it to one paying realtor with a straight face. Burn the 🟡 list in the following 48 hours before user #2 — that's the line between "works" and "feels like real software."
