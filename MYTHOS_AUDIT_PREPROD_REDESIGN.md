# Mythos Audit — Pre-Production Output Redesign
**Date:** April 29, 2026 | **Verdict:** Ship redesign before Day 14c.

## Bottom line
Days 14a + 14b proved the brief is winning on content (real Victoria schools/parks/businesses, real distances, real market data). The founder's "too many information" feedback says the brief is losing on usability. Hard-to-use industry-leader looks identical to noisy mediocrity at soft launch. **Cut hard. 17 hours of renderer-only work. No new prompt.**

## The redesign — one sentence
Replace the 12-section vertical scroll with **Plan / Shoot / Post tabs**, lead with **ONE hero hook** + collapsed alternates, compact the shot list to **one line per shot with hero gold-bordered**, move filming notes off the page into `/production/checklist`, drop pitch entirely, collapse local relevance into a single drawer, replace the bottom CTA buffet with a **sticky context-aware CTA per tab**.

## Tier reassignments

| Section | Today | New |
|---|---|---|
| Hook (1 hero, 4 alternates) | 5 equal cards, 500px | **T1 hero + collapsed alternates** |
| Shot List (7 rows) | 700px passive list | **T1 compact, ★ on hero shot** |
| Thumbnail direction | small mid-page | **T1 right column, sticky CTA "Open in Studio"** |
| Title + CTA | bottom | **T1 in Post tab** |
| Hook alternates (4) | full cards | **T2 toggle "Try another angle"** |
| Opener variants | full section | **T2 fold under hero hook as "alt opener"** |
| B-roll list | full section | **T2 accordion in Shoot tab** |
| Pre-publish checks | full section | **T2 in Post tab** |
| Filming notes | 5 sub-cards | **T3 → move to /production/checklist** |
| Local relevance | 4 cards | **T3 single accordion "Why this works in your market"** |
| Pitch | full section | **T4 — drop from view, keep in JSON** |
| Cross-pillar CTA bar | bottom | **T1 sticky per tab** |

## Plan / Shoot / Post tabs

```
PLAN tab     → hero hook + thumbnail + start-shoot CTA + compact shot list + market notes
SHOOT tab    → checkable shot list + b-roll + filming notes accordion + done-filming CTA
POST tab     → titles + alt openers + pre-publish checks + caption + post-pack CTA
```

Each tab gets a URL fragment. "Start shoot" deep-links to Shoot AND warms `/production/checklist` via the existing base64url hash.

## Hero hook display

```
HOOK · curiosity
"The mudroom every Move-Up family wants —
 and the school it walks to."
↳ Names a concrete payoff (school) the viewer already cares about.
[Copy] [Save] [↻ Try another angle ▾]
```

"Try another angle" toggle reveals the 4 alternates as small chips. Tap to swap which is hero.

**Day 14c folds into this.** Re-shape the prompt to return 3 distinct creative directions (each with its own hook + thumbnail moment + lead shot) in the SAME JSON response. Swap without re-prompting. Costs ~150 prompt tokens. Stretch to Day 16.

## Shot list v2 — the workhorse

```
SHOT LIST · 7 shots · ~30s
□  0-3s   Front door push-in, kettle audio
□  3-8s   Hallway → mudroom reveal       ▸
★  8-14s  Hero: pegs, lunchbox, school view
□  14-20s Window light, kid drawing on table
□  20-25s Park 31m away — Blackwood Park ▸
□  25-28s Walk to school — 408m callout
□  28-30s CTA "Tour with me"
[Open as on-set checklist →]
```

Specifics:
1. One line per shot. Retention notes hidden behind ▸ caret. Cuts vertical from ~700px to ~280px.
2. Checkboxes visual-only here; real ones live in `/production/checklist`. Don't fork state.
3. Hero shot (matches `thumbnailDirection.momentTimestamp`) gets ★ + gold left-border.
4. Mobile: 44px tap targets minimum.
5. Drag-to-reorder cut from MVP.

## Mobile-first layout (380px)

```
◀ 414 Cook St · Just Listed                  sticky 40px
[Plan] [Shoot] [Post]                         sticky 48px
─────────────────────────────────
HOOK · curiosity
"The mudroom every Move-Up family wants —
 and the school it walks to."
[Copy] [Save] [↻ Try another ▾]
─────────────────────────────────
SHOT LIST · 7 · ~30s
• 0-3s   Front door push-in
• 3-8s   Hallway → mudroom
• 8-14s  HERO mudroom + school ★
• 14-20s Window light, table
• 20-25s Blackwood Park 31m
• 25-28s Walk to school 408m
• 28-30s CTA "Tour with me"
─────────────────────────────────
THUMBNAIL
Frame: 0:08 · "MUDROOM GOALS"
Tone: warm, practical
─────────────────────────────────
[▾ Why this works in your market]
─────────────────────────────────
🎬 START SHOOT  →                             sticky bottom 56px
```

Rules: sticky header + sticky CTA, no horizontal scroll, gold as the only accent, 44px tap targets.

## Implementation cost (5-day budget)

| Change | File | Hours |
|---|---|---|
| Tabs + sticky header | components/BriefResult.tsx (rewrite) | 4 |
| Hero hook + collapsed alternates | BriefResult.tsx | 2 |
| Shot list compact rows + caret | BriefResult.tsx | 2 |
| Move filming notes → /production/checklist hash | BriefResult.tsx + checklist/page.tsx | 3 |
| Drop pitch from view | BriefResult.tsx | 0.25 |
| Local relevance accordion | BriefResult.tsx | 1 |
| Sticky bottom CTA mobile | BriefResult.tsx | 1 |
| Tab-aware URL fragments | page.tsx + BriefResult.tsx | 1.5 |
| Visual polish (one accent, typography) | BriefResult.tsx + tailwind | 2 |
| iPhone Safari + Android Chrome 380px QA | manual | 2 |
| **Core redesign total** | | **~17 hrs (2.5 days)** |
| Day 14c (3 directions in one prompt + swap) | lib/prompts.ts + types + BriefResult | 6 — **STRETCH to Day 16** |

## What NOT to touch
- The prompt itself (renderer-only ship = fast + no AI regression)
- Niche picker / form (founder's complaint is exclusively about output)
- History / library wiring (already works against PreShootOutput)

## What to drop from the page entirely
- **Pitch** — restates the user's inputs back at them. Keep in JSON for History/PDF, render zero on this page.
- **Filming notes** — gear/lighting/ToD/sound/risk are on-set reference. They live on `/production/checklist`, passed via the existing base64url hash.

## The closing argument
Mintflow's positioning isn't "we generated more text than the next tool." It's "we showed you the right thing at the right step." That's a stronger story for soft launch and worth the brutal cut. Make it easy first. Make it deeper second.
