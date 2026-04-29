# Mythos Audit — Day 13 Inspection
**Date:** April 29, 2026 | **Soft launch:** May 6, 2026 (T-7, 5 working days)
**Scope:** Day 12 (`080f41b`, `bf0824b`) + Day 13 (`2cbd38c`)

## Bottom line
Days 12 and 13 are ship-ready for soft launch with **three sub-30-minute fixes**. No structural problem. The three issues, untreated, would make the founder look amateur to the first 5 BC realtors.

## Three blockers — fix BEFORE Day 14

### 1. Two founder sections on the home page (~15 min)
`app/page.tsx:145-173` (old "Founder Note" with Tuesday/Notion/Canva/ChatGPT framing) AND `app/page.tsx:202-271` (new "About the founder" with Dhaka/Victoria) both render. Trust whiplash.
**Fix:** delete `app/page.tsx:145-173`, keep the new section.

### 2. /about missing from header nav (~5 min)
Top nav has Pre-Production / Production / Post-Production / Distribution / Pricing only. About is footer-only. Strongest founder-trust page invisible to desktop visitors.
**Fix:** add `{ href: "/about", label: "About" }` to NAV array in `components/Header.tsx`.

### 3. UserMenu Settings link points to /settings/voice not /settings (~2 min)
`components/UserMenu.tsx:113`. Settings index already exists with both Voice and Brand kit; menu currently bypasses it.
**Fix:** change `href="/settings/voice"` to `href="/settings"`.

**Total: ~22 minutes.**

## About page polish (5 specific edits, ~20 min, optional)

1. Hero subhead generic — end with concrete proof: "One studio. Trained on Greater Victoria — schools, foreshore, OCP zoning, the actual sidewalks."
2. "For ten years we shot..." needs a number — "200+ projects across..." Use the real number.
3. Paragraph 4 buries the best line — "A creator and a half-formed idea and whatever came out came out" should LEAD that paragraph.
4. Credentials line asymmetric — Silent Story has no year, Rawfilm does. Annotate all three (Mintflow 2026, Silent Story 2023, Rawfilm 2013).
5. Bottom CTA verb mismatch — hero says "Try a brief", bottom says "Start a brief". Standardize on "Try a brief" everywhere.

## Home Founder section — keep / cut / add
- Keep: split-layout with Lovelu pin-tag avatar.
- Cut: credential pills row (lines 244-257) — duplicates /about line 166.
- Add: ONE concrete project/client name from Rawfilm.

## Pricing — Day 17 risk (not blocker)
Studio $79 leans on 3 (v2) features that won't ship May 6. Solo realtors will pick Creator and never look at Studio. Need ONE shipping-now feature only Studio gets (multiple voice profiles, brand kit per listing, PDF brief export with brokerage cover sheet).

Annual `$24.17` reads accountant-y — round to `$24`. Internal docs say "$29" but page shows "$24" because annual is default. Pick one.

## Amplify in Day 14+

1. **The /about founder vision is the best copy on the site.** When Day 14 builds Pre-Production, drop a single callback line — e.g., a small "Why a brief?" footnote nodding to the Dhaka treatment-and-shot-list discipline. Pre-Production should feel *voiced*.
2. **Four-pillar IA + 301 redirects** is textbook. Keep the discipline — every new sub-route slots under existing pillar.
3. **Waitlist endpoint pattern** (zod → service-role → RLS-locked SELECT) is production-grade. Reuse template for every public-write endpoint.

## Deferred
- UserMenu pre-hydration placeholder needs `animate-pulse` (UserMenu.tsx:63). 30 sec.
- /login page styling diverges (emerald + bare neutrals) from gold-on-dark. Defer to Day 17.
- CTA verb chaos — standardize "Try a brief" for /pre-production landings.
- Keyboard arrow-key navigation in UserMenu. Post-launch.
