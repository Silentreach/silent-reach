# MINTFLOW RE-ARCHITECTURE PLAN
**Author:** Mythos | **Date:** April 29, 2026 | **For:** Deloar Hossain
**Sprint context:** Day 11/16. Soft launch May 6. 7 days to ship-or-defer.

## Bottom line

Don't try to build the full re-architecture before May 6. Ship the *shape* of it — new IA, new pillars, address input on Pre-Production, per-shot cards on Production, playbook on Post — with shallow depth, and use the soft launch to learn which pillar your earliest users actually pull on. Then build the deep version of *that* pillar first in Days 17-30.

## New IA (renames + redirects)

```
Top nav: Pre-Production · Production · Post-Production · Distribution · Pricing · About
Old → New:
  /pre-shoot       → /pre-production
  /post-upload     → /post-production
  /reel-multiplier → /distribution/reels
  /reels/outcomes  → /distribution/analytics
  /thumbnail-studio → moved under /post-production/thumbnails
  /history         → merged into /dashboard
```

## Pre-Production: do not scrape BC Assessment

BC Assessment ToS prohibits automated access, Cloudflare bot protection, IP ban risk, copyright on assessed values. Bootstrapped one-person shop cannot absorb that risk.

Hybrid enrichment instead:
- Google Geocoding ($0.005/call) — address → lat/lng
- Google Places Nearby Search ($0.16/address) — schools, parks, restaurants, transit, museums, golf
- Walk Score API (free 5k/day)
- BC Data Catalogue (free, CC-BY) — schools, parks, ALR, OCP zoning
- City of Victoria + CRD Open Data (free) — heritage, neighborhoods, school catchments
- MLS listing: user pastes URL or full text, Claude Haiku parses ($0.002/call)
- Manual fallback: 6-field form (beds, baths, sqft, year, lot, price)

Per-user cost at 50 briefs/month: ~$4. Cache by place_id 30 days, set per-user rate limit, Google billing alarm at $50/mo, hard cap $200/mo.

## Production: per-shot cards on phone

- Phone-first card view per shot. PDF export deferred to v1.1.
- Add `/settings/gear` (cameras, lenses, drones, stabilizer, audio).
- Production prompt receives shot list + gear profile, returns: shot type, framing, duration, gear, lens/focal, movement, audio, must-cover checklist, cinematic note.
- Same `briefId` from Pre-Production — one source of truth, "Open in Production" copies forward.

## Post-Production: Editor's Playbook

Project-level playbook with sections:
1. Edit structure (opener / body / climax / CTA)
2. Pacing prescriptions (cut-rate per phase)
3. Color (described look + suggested LUT family — generation deferred)
4. Music (existing Pixabay/Jamendo browser, AI tags 2-3 tracks)
5. SFX (Pixabay SFX added v1.1)
6. Motion (speed ramps, text timing)
7. VO script (text only v1, ElevenLabs v2.5)
8. Logo / brand (placement timing from brand kit)
9. Shot Review (v2, NOT v1 — see below)
10. Export specs

## "AI sees trash" — DEFERRED to v2 (Day 25-28)

Don't ship in v1. False positives are a taste problem, not a detection problem. v2 lite version: 8-12 evenly-spaced frames extracted client-side via existing ffmpeg.wasm, sent to Claude Sonnet 4.5 with a real-estate-specific reviewer prompt, $0.12/run, 15s wall clock. Position as "Shot Review" not "trash detection".

## Voice-over — DEFERRED to v2.5

ElevenLabs only. Mispronouncing "Saanich" or "Cordova Bay" kills credibility with hyper-local audience. v1 ships VO script (text), realtor reads it themselves.

## Pricing tiers (CAD)

| Tier | Price | Wedge |
|---|---|---|
| Free | $0 | 1 brief/mo, 1 watermarked reel — show off Pre-Production magic |
| Creator | $29/mo | 15 briefs, full Pre + Prod deck + Post playbook, 30 reels, no watermark |
| Studio | $79/mo | Unlimited briefs, Shot Review, LUT pack, ElevenLabs VO, 3 brand kits, 2 seats |
| Brokerage | $249/mo | 10 seats, white-label, API |

Pre-Stripe: pricing page has waitlist modal — captures email, grandfathers price for 12 months. No checkout flow needed by May 6.

## About / founder vision (draft)

> I'm Deloar Hossain, a filmmaker in Victoria. For ten years I've shot listings, weddings, and short films across British Columbia, and I kept watching realtors and homeowners spend a thousand dollars on a video that looks like every other video on the same street. The problem isn't budget — it's that nobody hands a creator a clear plan. Mintflow is the plan I wished someone had handed me on my first listing shoot: paste the address, get the unique selling points grounded in the actual neighborhood, the shot list, the on-set direction, the edit playbook, and the platform-ready cuts. It is a filmmaker's brain, made local to BC, available before sunrise on shoot day. I built it because Silent Story can only film one house per weekend. Mintflow can help film a thousand.

Hero: split-screen address-to-reel animation, 8-second loop, no founder portrait above the fold.

## 7-day pre-launch sprint (Days 12-16)

| Day | Tasks |
|---|---|
| 12 | Top-nav rename + route renames + 301 redirects (next.config.js) + old route shells as belt-and-suspenders for 30 days |
| 12 | New /about page with founder vision + hero |
| 13 | New /pricing page (3 tiers, waitlist modal, no Stripe) |
| 13-14 | Pre-Production address input + Google Places enrichment + ENRICHMENT block in BC_REAL_ESTATE_BRIEFING |
| 14-15 | Production per-shot card view + gear profile setting + AI direction prompt |
| 16 | Post-Production playbook output added to existing endpoint |
| 16 | QA, copy polish, soft-launch dry run |

Supabase migration: `briefs.enrichment` JSONB, `briefs.productionDeck` JSONB, `briefs.editorPlaybook` JSONB, `users.gearProfile` JSONB, `waitlist` table.

## Top 3 risks

1. **Google Places overage**: per-user daily rate limit + 30-day place_id cache + $50/mo billing alarm + $200/mo hard cap.
2. **Old URLs breaking mid-launch**: redirect map in next.config.js + keep old route shells 30 days + audit invite emails / social posts before rename.
3. **AI goes generic with enrichment data**: every USP must cite specific evidence ("Cordova Bay Elementary, 380m, 5-min via Walema Ave"). Add to banned phrases: "walkable", "close to amenities", "moments from", "minutes to". Test against 5 real Victoria listings before launch.

## v2 (Days 17-30) and v3 (Day 30+)

v2: BC Open Data ingestion, Production v1.1 (lens/focal, sun position, PDF export), Post v1.1 (Pixabay SFX, thumbnail-studio merge), Shot Review (Day 25-28), LUT pack v1.

v3: scheduled posting, ElevenLabs VO, curated LUTs, multi-seat brokerage tier, public API, Stripe activation.
