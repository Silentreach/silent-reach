# MYTHOS AUDIT v3 (FINAL) — Reel Multiplier ship-readiness pass
**Date:** 2026-04-29
**Scope:** end-to-end functional trace of the 5 flows on current
`/tmp/silent-reach`. Bugs only — no polish, no a11y, no optimization.

---

## Found 3 bug(s). Patch needed before shipping.

---

### BUG 1 — `<PackageCard>` is not keyed by platform; tab switches keep stale state.
**File:** `components/ReelMultiplier.tsx:928`
**Severity:** 🔴 produces wrong output. SHIP-BLOCKER.

```tsx
{pkg && <PackageCard pkg={pkg} ... excludeMusicIds={...} onTrackPicked={...} stillInGallery={...} />}
```
No `key={pkg.platform}`. When the user clicks the YT tab after mounting on
IG, React reuses the same `PackageCard` instance and only swaps props.
Local state survives the swap:

- `editedHook` initialized once from `pkg.hookLine` (line 1006) — stays as IG's hook.
- `editedCuts` initialized once from `pkg.cutMarkers` (line 1010) — stays as IG's cuts.
- `musicFile`, `pixabayTrackId`, `musicBPM` (lines 962–964) — stay as IG's track.
- `<MusicBrowser key={musicResetCount}>` (line 1361): `musicResetCount` is 0
  on tab switch, so MusicBrowser does NOT remount. Its inner
  `useEffect(() => doSearch(defaultQuery), [])` has empty deps and only
  ran for IG's query. `excludeMusicIds` changes but is only consumed
  inside `doSearch`, which is never re-invoked.

**Repro:** Generate 3 packages, render IG (lands in gallery), click YT
tab, click "Render preview". Result: a render labeled YT but built from
IG's hook text, IG's cuts, IG's music. `packages_json.platform` is
correctly stamped from `pkg.platform`, so the DB row LOOKS right but the
audio/visual content doesn't match the YT package the user is viewing.

**Flow 3 directly fails as described.** "Music auto-picks DIFFERENT track"
never happens — autoPick only ran on IG's mount.

**Fix (10 sec):** add `key={pkg.platform}` on the PackageCard element at
line 928.

---

### BUG 2 — `generateLockRef` never resets after an error; user is locked out of retry.
**File:** `components/ReelMultiplier.tsx:642–645`
**Severity:** 🔴 retry path is dead.

```tsx
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : "Unknown error";
  setError(msg); setStage("error");
}
```
Success branch sets `generateLockRef.current = false` at line 641. The
catch does not. After ANY failure (network blip, 422 from sanitizeCuts,
60s Vercel timeout, abort) the lock stays `true` forever. The "Try
again" button at line 769 calls `generate()`, which immediately returns
at line 626 (`if (generateLockRef.current) return`). User is hard-stuck;
only escape is a page reload. No error toast either, because
`setError(null)` runs before generate's silent early return.

**Fix (5 sec):** add `generateLockRef.current = false;` inside the catch
block (line 645).

---

### BUG 3 — `createReel` always inserts `content_type: "real_estate"`.
**File:** `components/ReelMultiplier.tsx:1149`, `lib/db/reels.ts:60`
**Severity:** 🔴 produces wrong DB rows (latent for tomorrow's demo).

```tsx
content_type: "real_estate", // TODO: thread niche through from pre-shoot brief
```
The component never threads a niche through. The API route accepts
`contentType: "real_estate" | "construction" | "general"`
(route.ts:21) but the client never sends it (line 622 omits
`contentType`), so the niche never round-trips. On insert, every reel
is stamped real_estate.

`lib/db/reels.ts:60` also defaults to `"real_estate"` if input is
undefined, so removing the literal alone won't fix it without also
fixing the DB helper.

For tomorrow's BC realtor (real-estate-only) demo this won't surface.
But the user explicitly asked. Flagged 🔴 because the row written is
observably wrong if any non-real-estate footage runs through.

**Fix (15 min):** thread `contentType` from the upload form into
`PackageCard.onRender`, send it on the API call (line 622), pass it
into `createReel`. Default the helper at `lib/db/reels.ts:60` to
`"general"` (or `null`) instead of `"real_estate"`.

---

## Per-flow trace

### Flow 1 — Upload to render: 🟡 mostly works
1–4. Frame extraction, motion delta, subjectZone, AI fetch with
   AbortController (line 619), getServerUserContext (route.ts:60),
   sanitize 422 path (route.ts:80–85) — verified clean.
5. Three packages display, music auto-picks ✓. `buildPlatformMusicQuery`
   (line 945) and excludeIds + previousTrackIds at line 1368 ✓.
6–7. Pre-roll 250ms + double-paint at videoRender.ts:300–306 ✓.
   MediaRecorder tries MP4 High first (line 175) ✓. Music gain envelope
   (line 256) and outro audio fade (line 269) ✓.
8. Preview blob + thumb + onPreviewReady ✓.
9. createReel fire-and-forget ✓ — but see Bug 3.
10. Gallery side-by-side ✓.

🟡 Edge: `videoRender.ts:99` sets `video.muted = false` then
`video.volume = 0`. iOS Safari sometimes ignores `volume = 0` and emits
to speakers during render. Not a crash. The B7 banner already warns
iOS Safari users.

### Flow 2 — Try a different version: 🟡 works
Lines 1264–1304 trace cleanly. `pixabayTrackId` pushed to
`previousTrackIds` (TS 5.4 narrows the const capture inside the
functional setState — fine). `musicResetCount++` remounts
MusicBrowser via key. autoPick re-runs on mount.
`excludeIds` includes `previousTrackIds`. Cut jitter ±0.3s applied.
Render-button disabled-while-rerolling guard at line 1196 works.

🟡 Edge: if `doSearch` returns `[]` on the new query and autoPick
never fires, `musicFile` stays null and Render stays disabled with
no "music search returned nothing" hint. Mitigated by the
broaden-to-first-word retry (MusicBrowser:88). Not a blocker.

### Flow 3 — Multi-platform side-by-side: 🔴 BROKEN — see Bug 1
The whole flow is functionally broken because of the missing key.
Switching to YT and rendering produces a YT-named file with IG's
content. **Biggest bug in the tree right now.**

### Flow 4 — Custom music upload: ✅
Lines 1349–1359 clear `pixabayTrackId`, set `musicFile`, call
`detectBPM` with `.catch(() => null)` on timeout. Custom-track
green badge with X at lines 1339–1344. Clean.

### Flow 5 — Three thumbnail templates: ✅
- `<DesignedThumbPreview template={i} />` at line 1510 routes by index.
- `drawDesignedThumb` (line 287): `tpl===1` → minimal,
  `tpl===2` → cinematic-stack, default → editorial. Three independent
  draw paths (lines 309 / 369 / 411): different fonts, weights,
  alignments, gradients. No shared fall-through.
- `ensureLuxeFontsLoaded` (line 232) awaits Cormorant + Playfair +
  Inter before draw. globals.css imports verified per v2.
- No "Mintflow" leak: `brandName` reads `brandKit.name`; templates
  only paint a brand string if non-empty.
- Per-card download (line 1518–1532) calls `renderDesignedThumbnail`
  with the same `i` index → matching JPEG.

🟡 Edge: `DesignedThumbPreview`'s effect (line 1582) has a `cancelled`
flag but `setReady(true)` (line 1612) isn't gated on it. If the
component unmounts after `drawDesignedThumb` returns but before
flush, setReady fires on an unmounted component → React warning,
no visible breakage. Inner `URL.revokeObjectURL(url)` runs in both
the inner `finally` and the outer return cleanup (lines 1612 + 1620)
— idempotent. Not a bug.

---

## Specific concerns scan

- **Setters on unmounted components:** `MusicBrowser.selectTrack`
  calls `setSelectingId(null)` after fetch with no unmount-abort
  (rare path, MVP-acceptable). `DesignedThumbPreview` setReady noted
  above. Neither crashes.
- **Missing awaits:** None that affect correctness. `detectBPM` and
  `createReel` are intentionally fire-and-forget with `.catch`.
- **Double-fire on click:** `generate` guarded by `generateLockRef`
  (broken in error path — Bug 2). `onRender` guarded by
  `disabled={renderState === "rendering" || ...}` (line 1196).
  `selectTrack` guarded by `disabled={isLoading}` (MusicBrowser:222).
- **Cleanup leaks:**
  - audio-routing-failed listener (line 537) ✓ removed on unmount
  - thinking-phrase interval (line 580) ✓
  - abortRef Claude fetch (line 591) ✓
  - MusicBrowser audio (line 65) ✓
  - renderReel revokes sourceUrl + closes audioCtx (lines 336–337) ✓
  - Gallery remove revokes info.url + thumbUrl (line 855–857) ✓
  - 🟡 `customLogo` for `kind:"video"`: objectURL created at line 736,
    `setCustomLogo(null)` at line 717 does NOT revoke it. Bounded
    (≤1 logo per session). Not a blocker.
- **3 templates render genuinely different visuals:** ✅
- **content_type hardcode:** ✅ confirmed — see Bug 3.

---

## Conclusion

**Found 3 bug(s). Patch needed before shipping.**

Bug 1 is a 10-second one-line fix and unblocks Flow 3 entirely.
Bug 2 is a 5-second one-line fix and unblocks error recovery.
Bug 3 is acceptable for tomorrow's BC realtor demo (real-estate-only)
but will corrupt analytics if niche selection ever ships without a
paired patch — recommend fixing the literal at ReelMultiplier.tsx:1149
and the default at reels.ts:60 before rollout.

Without Bugs 1 and 2 fixed, do NOT ship. With them, the other four
flows trace clean and the renderer is solid.
