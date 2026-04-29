# Mintflow Pre-Production — Mythos Brainstorm
**Date:** April 29, 2026 | **Author:** Mythos | **For:** Deloar Hossain

## Bottom line

Ship the **3-Direction Brainstorm** as the single creative wedge beyond Day 14's address enrichment. The address enrichment makes briefs accurate; 3-Direction makes them feel creative — and creativity is what reframes Mintflow from "AI brief generator" (commodity) to "AI creative partner" (ownable).

## The four moves shipped Day 14 (layered on address enrichment)

1. **Niche-adaptive form** — opens with one question: "What are we shooting?" Three large cards (Real Estate / Construction / General). Selection swaps the entire form schema. Two-row layout: Row 1 = the niche's "magic" inputs (always visible, max 3 fields), Row 2 = "Adjust details" expandable (collapsed default; 80% never open it).

2. **3-Direction Brainstorm** — instead of one full brief, AI returns 3 distinct creative directions as cards (e.g., "The Sunset Tease" / "The Numbers Flex" / "The Move-In-Day Family Story"). Each card: punchy 4-word headline + 1-line concept + "Build This One →" CTA. User picks one → THEN expand into full brief. Two-stage prompt. Cheap (~1 hr) for outsized wow.

3. **Mood Picker** — 6 chips, multi-select up to 2: Cinematic / Documentary / Energetic / Calm / Luxury / Editorial. Each maps to a `MOOD_PROFILE` block with concrete directives.

4. **Hero Shot Anchor** — universal one-line field: "The ONE shot you must get." Forces visual thesis upfront. All sections of the brief (hooks, shot list, opener, thumbnail) build toward it.

## Per-niche magic fields

### Real Estate
- **Address** (autocomplete via Nominatim, triggers Day 14 enrichment)
- **Listing Stage** chips: Coming Soon / Just Listed / Open House / Price Improvement / Sold (case study). THE magic field — rewrites hooks based on lifecycle. Coming Soon teases + withholds; Price Improvement addresses objections; Sold is flex/credibility.
- **Buyer Persona** multi-select (max 2): First-Time / Move-Up / Downsizer / Investor / Out-of-Province / Luxury

Conditional logic: Open House adds date picker + urgency hooks. Luxury auto-enables Cinematic Mode (longer takes, no narration default). Investor swaps shot emphasis to numbers/cap-rate B-roll.

### Construction
- **Project Phase** chips: Demo / Framing / Rough-In / Drywall / Finish / Final Reveal. THE magic field — phase determines whether process video, transformation tease, or hero reveal.
- **Transformation Arc** chips: Problem→Solution / Before→After / Process Hero / Time-lapse / Trade Spotlight
- **Trade Focus** multi-select (max 2): GC / Carpenter / Mason / Electrician / Plumber / Tile / Landscape — drives B-roll specificity

Conditional logic: Demo phase auto-injects "lead with destruction" hooks + dust/PPE notes. Final Reveal toggles homeowner-reaction optional field. Time-lapse swaps output to interval recommendations + frame-count math.

Bonus magic micro-field: **Client-Facing vs Trade-Facing toggle** — homeowners (lifestyle, finish, pride) vs other contractors (process detail, technique). Completely changes B-roll priority.

### General
- **Content Mode** chips: Day-in-the-Life / Explainer / Review / Tutorial / Vlog / Hot Take POV
- **Brand Archetype** chips (single): Sage / Hero / Jester / Lover / Rebel / Caregiver. THE magic field — most creator tools never ask this; it's the difference between sounding like everyone else and sounding like THIS creator.
- **Audience Pain or Curiosity** required free text: "What does your viewer want to know or feel?"
- Tone slider: Earnest / Playful / Edgy
- Optional persistent **Signature Sign-off** field — user's catchphrase, woven into closings

## Three "wow" moments a BC realtor will screenshot

1. **Address → form auto-fills in 4 seconds.** Realtor types "414 Cook St, Victoria BC" → before they tab to next field, neighborhood vibe / buyer persona suggestion / 3 USP candidates with citations / audience field all populate. They watch the form fill itself.
2. **3 creative directions instead of one brief.** Realtor clicks Generate → three cards bloom: "The Sunset Tease" / "The Numbers Flex" / "The Family Story." The AI isn't guessing — it's pitching. They tell another realtor.
3. **Listing-stage-aware hooks.** Toggle from "Just Listed" to "Coming Soon" → hooks visibly rewrite. Urgency drops, mystery climbs, CTA shifts from "book a showing" to "DM for early access." The moment they realize Mintflow understands the BUSINESS of real estate, not just the content.

## Three things to NOT ship

1. **Voice memo input** — Web Speech API uneven on Safari, Whisper costs add per-brief variable. Realtors are often on-site/in cars. Two-day build minimum. Park.
2. **Mood board image upload (vision)** — if brief doesn't visibly reflect uploaded image, user concludes AI is broken. Mood chips give 80% value at 5% failure surface. Wait for v3.
3. **AI follow-up questions after first draft** — sounds smart, breaks flow. Realtors want output, not a quiz. Hero Shot Anchor captures the most important follow-up upfront.

## Day 14 budget (~7 hrs)

- Address enrichment + ENRICHMENT block + USPs/locationShots arrays (already planned): 3 hrs
- Niche-adaptive form skeleton (3-card picker → schema swap): 1.5 hrs
- Real Estate magic fields (Listing Stage, Buyer Persona): 45 min
- Construction magic fields (Project Phase, Arc, Trade Focus): 45 min
- Mood Picker (6 chips, universal): 30 min
- Hero Shot Anchor field (universal): 15 min
- 3-Direction Brainstorm (two-stage prompt + card UI): 1 hr
- Prompt-engineering wiring: 30 min

If running long, drop in-place section iteration to v2.

## v2 (Days 17-25)
- General-niche magic fields (Content Mode + Brand Archetype + Tone + Signature Sign-off)
- Reference Reel Paste (URL parsing, oEmbed extraction, REFERENCE_VIBE block)
- In-place section iteration (Refine buttons per section)
- Brief library + Remix from Past Brief

## v3+ parked
- Voice memo input
- Mood board / vision input
- AI follow-up questions
- Brief versioning UI
- Auto-detected price tier from MLS-adjacent data
- Multi-language brief output

## The recommendation in one paragraph

If you can ship only ONE creative thing beyond Day 14's address enrichment, ship the **3-Direction Brainstorm**. It changes the mental model from "I hope AI guesses right" to "AI is showing me options I didn't think of." It's the cheapest wow per hour of build (~1 hr), composes cleanly with everything else (niche fields, mood, hero shot all feed into the three directions), and solves the iteration problem implicitly. Listing-Stage hooks are the close second but only wow Real Estate users; 3-Direction wows everyone.

Ship 3-Direction + Listing-Stage chips + Hero Shot Anchor + Mood Picker on Day 14. That's the pre-launch creative wedge.
