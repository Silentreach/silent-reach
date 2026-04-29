/* Day-14 bridge: translates niche-aware Pre-Production inputs into the
   legacy PreShootInput shape (so we keep using the existing prompt
   builder) AND returns an additional context block injected into the
   system prompt to carry the magic fields the legacy form never had. */

import type { PreShootInput } from "@/types";
import type {
  NicheInputs,
  RealEstateInputs,
  ConstructionInputs,
  GeneralInputs,
  RealEstateListingStage,
  RealEstateBuyerPersona,
  ConstructionPhase,
  ConstructionArc,
  Trade,
  Mood,
} from "@/types/preProduction";

export interface BridgeEnrichment {
  geocode: { formattedAddress: string; lat: number; lng: number; neighborhood?: string; postalCode?: string };
  nearby?: {
    schools: Array<{ name: string; distanceMeters: number; category: string }>;
    parks: Array<{ name: string; distanceMeters: number; category: string }>;
    amenities: Array<{ name: string; distanceMeters: number; category: string }>;
    landmarks: Array<{ name: string; distanceMeters: number; category: string }>;
  } | null;
}

function enrichmentBlock(enr?: BridgeEnrichment): string {
  if (!enr) return "";
  const lines: string[] = [
    "",
    "",
    "ENRICHMENT (verified neighborhood data — every USP and locationShot MUST cite a specific name and distance from this list, not invented):",
    `- Resolved address: ${enr.geocode.formattedAddress}`,
  ];
  if (enr.geocode.neighborhood) lines.push(`- Neighborhood: ${enr.geocode.neighborhood}`);

  const fmt = (places: { name: string; distanceMeters: number }[], label: string, cap = 5) => {
    if (!places.length) return;
    const top = places.slice(0, cap).map(p => `${p.name} (${p.distanceMeters}m)`).join("; ");
    lines.push(`- Nearby ${label}: ${top}`);
  };
  if (enr.nearby) {
    fmt(enr.nearby.schools, "schools");
    fmt(enr.nearby.parks, "parks / green space");
    fmt(enr.nearby.amenities, "amenities (transit / cafés / restaurants)");
    fmt(enr.nearby.landmarks, "landmarks (museums / golf / beaches)");
  }
  lines.push("");
  lines.push("DIRECTIVE: Every USP must cite a specific evidence point — name + distance + how-to-get-there. The AI's job is reporting, not advertising. Banned: 'walkable', 'moments from', 'close to amenities', 'minutes to'. Use real distances ('380m to Cordova Bay Elementary via Walema Ave', not 'walkable to schools').");
  return lines.join("\n");
}


const STAGE_LABELS: Record<RealEstateListingStage, string> = {
  coming_soon: "Coming Soon",
  just_listed: "Just Listed",
  open_house: "Open House This Weekend",
  price_improvement: "Price Improvement",
  sold: "Sold (case study)",
};

const PERSONA_LABELS: Record<RealEstateBuyerPersona, string> = {
  first_time: "First-Time Buyer",
  move_up_family: "Move-Up Family",
  downsizer: "Downsizer",
  investor: "Investor",
  out_of_province: "Out-of-Province Relocator",
  luxury: "Luxury",
};

const PHASE_LABELS: Record<ConstructionPhase, string> = {
  demo: "Demo",
  framing: "Framing",
  rough_in: "Rough-In",
  drywall: "Drywall",
  finish: "Finish",
  final_reveal: "Final Reveal",
};

const ARC_LABELS: Record<ConstructionArc, string> = {
  problem_solution: "Problem -> Solution",
  before_after: "Before -> After",
  process_hero: "Process Hero",
  time_lapse: "Time-lapse",
  trade_spotlight: "Trade Spotlight",
};

const TRADE_LABELS: Record<Trade, string> = {
  gc: "GC",
  carpenter: "Carpenter",
  mason: "Mason",
  electrician: "Electrician",
  plumber: "Plumber",
  tile_finish: "Tile / Finish",
  landscape: "Landscape",
};

const MOOD_DIRECTIVES: Record<Mood, string> = {
  cinematic: "Cinematic — favor locked-off wides + slow pushes; opener is a held frame, not a snap-cut; pacing breathes.",
  documentary: "Documentary — handheld feel acceptable; resist over-styling; let the place / people read as themselves.",
  energetic: "Energetic — fast cuts, motion-driven transitions, beat-aware pacing; no shot held longer than 1.8s.",
  calm: "Calm — wide, still, breathable; minimum 3s holds; avoid speed ramps.",
  luxury: "Luxury — controlled, glossy, restrained; very few cuts, every cut earned; no on-screen text bigger than a watermark.",
  editorial: "Editorial — magazine-grade composition, negative space, one focal element per frame; thumbnail must use a lot of empty.",
};

export interface BridgeOutput {
  legacyInput: PreShootInput;
  injectedContext: string;
}

export function bridgeNicheToLegacy(
  inputs: NicheInputs,
  address?: string,
  enrichment?: BridgeEnrichment,
): BridgeOutput {
  if (inputs.niche === "real_estate") return bridgeRealEstate(inputs, address, enrichment);
  if (inputs.niche === "construction") return bridgeConstruction(inputs, address, enrichment);
  return bridgeGeneral(inputs);
}

function moodBlock(moods: Mood[]): string {
  if (!moods.length) return "";
  const lines = moods.map((m) => `- ${MOOD_DIRECTIVES[m]}`).join("\n");
  return `\n\nMOOD PROFILE (max 2 picked by the user — honor both, do not contradict):\n${lines}`;
}

function heroShotBlock(heroShot?: string): string {
  if (!heroShot?.trim()) return "";
  return `\n\nHERO SHOT ANCHOR: ${heroShot.trim()}\n` +
    `Treat this as the climactic visual of the reel. Hooks must build anticipation toward it. ` +
    `Shot list places it at the structural climax. Thumbnail direction must be a still or near-still of this exact moment.`;
}

function bannedPhrasesBlock(): string {
  return "\n\nBANNED PHRASES (do NOT use any of these or close paraphrases): " +
    "stunning, elevated, boasts, nestled, your forever home, must-see, imagine yourself, sun-drenched, " +
    "walkable, walking distance, moments from, close to amenities, minutes to, steps away, perfect family home, " +
    "dream home, won't last. " +
    "Replace abstract claims with concrete numbers, distances, and place names.";
}

function bridgeRealEstate(inputs: RealEstateInputs, addressOverride?: string, enrichment?: BridgeEnrichment): BridgeOutput {
  const address = addressOverride ?? inputs.address;
  const personasLabel = inputs.buyerPersonas.map((p) => PERSONA_LABELS[p]).join(", ") || "general buyer";
  const stageLabel = STAGE_LABELS[inputs.listingStage];

  const concept =
    inputs.conceptOverride?.trim() ||
    `Listing video for ${address || "the property"}. Stage: ${stageLabel}. Buyer pool: ${personasLabel}.`;

  const details = [
    inputs.mlsText?.trim() ? `MLS-style listing text:\n${inputs.mlsText.trim()}` : "",
    inputs.manualPropertyFacts && Object.values(inputs.manualPropertyFacts).some((v) => v != null)
      ? `Manual property facts: ${[
          inputs.manualPropertyFacts.beds && `${inputs.manualPropertyFacts.beds} bd`,
          inputs.manualPropertyFacts.baths && `${inputs.manualPropertyFacts.baths} ba`,
          inputs.manualPropertyFacts.sqft && `${inputs.manualPropertyFacts.sqft} sqft`,
          inputs.manualPropertyFacts.yearBuilt && `built ${inputs.manualPropertyFacts.yearBuilt}`,
          inputs.manualPropertyFacts.lotSqft && `${inputs.manualPropertyFacts.lotSqft} sqft lot`,
          inputs.manualPropertyFacts.askingPriceCad && `$${inputs.manualPropertyFacts.askingPriceCad.toLocaleString()} CAD`,
        ].filter(Boolean).join(" · ")}`
      : "",
  ].filter(Boolean).join("\n\n");

  const legacyInput: PreShootInput = {
    contentType: "listing_tour",
    targetAudience: personasLabel,
    location: address || "Greater Victoria, BC",
    videoLength: inputs.videoLength,
    platform: mapPlatform(inputs.platform),
    concept,
    details: details || undefined,
  };

  let injectedContext = `\n\nNICHE: BC Real Estate listing video.`;
  injectedContext += `\nLISTING STAGE: ${stageLabel}.`;
  if (inputs.openHouseDate) {
    injectedContext += `\nOPEN HOUSE DATE: ${inputs.openHouseDate} — anchor at least one hook variant to this date.`;
  }
  injectedContext += `\nBUYER PERSONAS: ${personasLabel}.`;
  injectedContext += `\n\nLISTING-STAGE DIRECTIVES (rewire hooks + CTA accordingly):`;
  injectedContext += stageDirectives(inputs.listingStage);
  injectedContext += personaDirectives(inputs.buyerPersonas);
  injectedContext += heroShotBlock(inputs.heroShot);
  injectedContext += moodBlock(inputs.moods);
  injectedContext += enrichmentBlock(enrichment);
  injectedContext += bannedPhrasesBlock();

  return { legacyInput, injectedContext };
}

function stageDirectives(stage: RealEstateListingStage): string {
  switch (stage) {
    case "coming_soon":
      return "\n- Hooks must tease without revealing the full property." +
        "\n- Withhold the hero shot until after the hook." +
        "\n- CTA: 'DM for early access' or 'Coming [date]'. Do NOT use 'Book a showing today' — listing is not yet active." +
        "\n- One hook variant should name the launch date if known.";
    case "just_listed":
      return "\n- Lead with one buyer-pain-point or one buyer-trigger feature in the first 1.5s." +
        "\n- CTA: 'DM for the showing schedule' or 'Open the showing link'." +
        "\n- Make sure at least one hook acknowledges the active listing status (urgency without hyperbole).";
    case "open_house":
      return "\n- Date and time are the primary CTA — every variant should at least imply 'this weekend'." +
        "\n- Lead with the moment that makes someone block off Saturday." +
        "\n- CTA: 'Open House [date] [time]'. Pin the address.";
    case "price_improvement":
      return "\n- Hooks address objections, not features. Why-now framing." +
        "\n- One hook variant should be a 'second look' invite for buyers who passed before." +
        "\n- CTA: 'New price. Same home. Worth a second look.'";
    case "sold":
      return "\n- Frame as a case study, not a tease. Past-tense voice." +
        "\n- One hook variant should be a numbers flex (days on market, over asking, multiple offers — only if true)." +
        "\n- CTA: 'DM for what your home could do' — not a showing CTA, a seller-pipeline CTA.";
  }
}

function personaDirectives(personas: RealEstateBuyerPersona[]): string {
  if (!personas.length) return "";
  const lines: string[] = ["\n\nBUYER PERSONA SHOT-PRIORITY OVERRIDES:"];
  for (const p of personas) {
    switch (p) {
      case "first_time": lines.push("- First-Time Buyer: emphasize affordability cues, low-maintenance details, neighborhood walkability with concrete distances."); break;
      case "move_up_family": lines.push("- Move-Up Family: emphasize storage, secondary spaces, school catchment, yard/outdoor area, mudroom or drop-zone."); break;
      case "downsizer": lines.push("- Downsizer: emphasize single-level living, low-step access, primary-on-main, lock-and-leave details, garden simplicity."); break;
      case "investor": lines.push("- Investor: emphasize numbers, suite potential, separate entrance, rental comp logic, cap-rate-adjacent B-roll (mailbox, suite door, separate utilities)."); break;
      case "out_of_province": lines.push("- Out-of-Province: emphasize location context (drive times to ferry, airport, downtown), climate/lifestyle cues, neighborhood character."); break;
      case "luxury": lines.push("- Luxury: longer takes, no on-screen text larger than a watermark, no narration. Hero shot earns 4+ seconds."); break;
    }
  }
  return lines.join("\n");
}

function bridgeConstruction(inputs: ConstructionInputs, addressOverride?: string, enrichment?: BridgeEnrichment): BridgeOutput {
  const phaseLabel = PHASE_LABELS[inputs.projectPhase];
  const arcLabel = ARC_LABELS[inputs.transformationArc];
  const tradesLabel = inputs.tradeFocus.map((t) => TRADE_LABELS[t]).join(", ");

  const concept =
    inputs.conceptOverride?.trim() ||
    `Construction project — phase: ${phaseLabel}, arc: ${arcLabel}${tradesLabel ? `, trades: ${tradesLabel}` : ""}.`;

  const legacyInput: PreShootInput = {
    contentType:
      inputs.projectPhase === "final_reveal" ? "before_after" :
      inputs.transformationArc === "trade_spotlight" ? "contractor_feature" :
      "renovation_walkthrough",
    targetAudience: inputs.audienceMode === "trade_facing" ? "Other contractors, sub-trades, builders" : "Homeowners and prospective build clients",
    location: addressOverride ?? inputs.address ?? "Greater Victoria, BC",
    videoLength: inputs.videoLength,
    platform: mapPlatform(inputs.platform),
    concept,
    details: inputs.siteSafetyConstraints?.trim() || undefined,
  };

  let injectedContext = `\n\nNICHE: BC Construction / Reno project video.`;
  injectedContext += `\nPROJECT PHASE: ${phaseLabel}.`;
  injectedContext += `\nTRANSFORMATION ARC: ${arcLabel}.`;
  if (tradesLabel) injectedContext += `\nTRADE FOCUS: ${tradesLabel}.`;
  injectedContext += `\nAUDIENCE MODE: ${inputs.audienceMode === "trade_facing" ? "Trade-facing — other contractors, sub-trades. Emphasize process detail, technique, gear vocabulary." : "Client-facing — prospective homeowners and build clients. Emphasize lifestyle, finish, pride."}`;
  injectedContext += `\nDRONE AVAILABLE: ${inputs.droneAvailable ? "yes — aerial shots permitted" : "no — DO NOT recommend any aerial shots"}.`;
  injectedContext += `\n\nPHASE DIRECTIVES (rewire hooks + B-roll accordingly):`;
  injectedContext += phaseDirectives(inputs.projectPhase);
  injectedContext += `\n\nARC DIRECTIVES:`;
  injectedContext += arcDirectives(inputs.transformationArc);
  if (tradesLabel) {
    injectedContext += `\n\nTRADE-SPECIFIC B-ROLL VOCABULARY (use the actual technique words, not generic 'tool detail'):`;
    injectedContext += tradeVocabulary(inputs.tradeFocus);
  }
  injectedContext += heroShotBlock(inputs.heroShot);
  injectedContext += moodBlock(inputs.moods);
  injectedContext += enrichmentBlock(enrichment);

  return { legacyInput, injectedContext };
}

function phaseDirectives(phase: ConstructionPhase): string {
  switch (phase) {
    case "demo":
      return "\n- Lead with destruction or discovery — what was hidden in the wall, what came down." +
        "\n- Hooks favor stakes and curiosity; avoid sentimental framing." +
        "\n- B-roll list MUST include 3+ technique-specific shots (e.g., 'sawzall through cast-iron stack')." +
        "\n- Filming notes call out dust mitigation, respiratory PPE, eye protection.";
    case "framing":
      return "\n- Emphasize scale and structure — the moment a beam lands, the moment a wall stands up." +
        "\n- Hooks favor transformation (skeleton appearing) and stakes (this is the bones)." +
        "\n- Filming notes call out fall protection, nail-gun discipline, sawdust visibility.";
    case "rough_in":
      return "\n- Emphasize the invisible work — pipes, wires, ducts that nobody sees once drywall goes up." +
        "\n- Hooks lean educational ('here's where the money is') for trade-facing." +
        "\n- B-roll: clean copper runs, panel detail, pressure tests, crimping moments.";
    case "drywall":
      return "\n- Transition phase — 'closing up' is the narrative." +
        "\n- Hooks tease the reveal coming next." +
        "\n- B-roll: mud lines, sanding dust at golden hour, level checks against fresh wall.";
    case "finish":
      return "\n- Emphasize craft — cabinetry detail, tile grout lines, hardware torque." +
        "\n- Hooks favor pride and craft-flex." +
        "\n- B-roll: shadow gaps, hardware reveals, tile alignment, paint sheen at glance angle.";
    case "final_reveal":
      return "\n- Hero shot territory. Withhold the wide reveal until structural climax." +
        "\n- Hooks tease scale or before-state to set up the reveal." +
        "\n- B-roll: homeowner reaction (if available), under-cabinet lights coming on, golden-hour exterior, walk-through opening shot.";
  }
}

function arcDirectives(arc: ConstructionArc): string {
  switch (arc) {
    case "problem_solution":
      return "\n- First 3s: name the problem visually. Body: solving it. Climax: the fix.";
    case "before_after":
      return "\n- Hard cuts between matching frames. Match lighting + angle on at least 2 transformation pairs. No slow dissolves.";
    case "process_hero":
      return "\n- Single technique, deep coverage. Long takes. Sound design from the technique itself (no music bed during the hero moment).";
    case "time_lapse":
      return "\n- TIME-LAPSE MATH: target frame count = (final_video_seconds * 30 fps). For a 60s reel that's 1800 frames." +
        "\n- Capture interval = (real_construction_minutes * 60) / target_frames. State the interval the user should set on their intervalometer." +
        "\n- Lighting consistency notes: specify acceptable cloud cover deltas, shoot windows (avoid full-sun-to-overcast within one sequence)." +
        "\n- Mention intervalometer or app option (e.g., DJI Mimo for phone, dedicated for camera).";
    case "trade_spotlight":
      return "\n- Single craftsperson at center. Hands-in-frame establishes scale and humanity. Closing shot is the worker stepping back to see the finished detail.";
  }
}

function tradeVocabulary(trades: Trade[]): string {
  const dict: Record<Trade, string[]> = {
    gc: ["walk-through with clipboard", "punch-list close-up", "sub coordination moment"],
    carpenter: ["header detail with level", "coping cut on baseboard", "hand-plane shaving curl", "mortise chisel close-up"],
    mason: ["trowel cut on weeping mortar", "stone fitting against template", "mortar mix consistency check", "level on first course"],
    electrician: ["torque wrench on copper lug", "panel breaker layout", "wire-strip swing", "voltage tester on outlet"],
    plumber: ["copper sweat-joint flame", "PEX crimp ring", "pressure test gauge", "drain slope check"],
    tile_finish: ["thinset comb pattern", "tile leveling clip", "grout sponge wipe", "shadow-line corner detail"],
    landscape: ["compactor on base course", "transit-grade elevation check", "irrigation manifold close-up", "first cedar siding panel set"],
  };
  return trades.flatMap((t) => dict[t].map((line) => `\n- ${TRADE_LABELS[t]}: ${line}`)).join("");
}

function bridgeGeneral(inputs: GeneralInputs): BridgeOutput {
  const legacyInput: PreShootInput = {
    contentType: "explainer",
    targetAudience: inputs.audience?.trim() || "general audience",
    location: "n/a",
    videoLength: inputs.videoLength,
    platform: mapPlatform(inputs.platform),
    concept: inputs.concept.trim(),
  };

  let injectedContext = `\n\nNICHE: General creator content (personal brand / education / vlog).`;
  injectedContext += `\nCONTENT MODE: ${labelGeneralMode(inputs.contentMode)}.`;
  injectedContext += `\n\nMODE DIRECTIVES:`;
  injectedContext += generalModeDirectives(inputs.contentMode);
  injectedContext += heroShotBlock(inputs.heroShot);
  injectedContext += moodBlock(inputs.moods);
  return { legacyInput, injectedContext };
}

function labelGeneralMode(mode: GeneralInputs["contentMode"]): string {
  return ({
    day_in_the_life: "Day-in-the-Life",
    explainer: "Explainer",
    review: "Review",
    tutorial: "Tutorial",
    vlog: "Vlog",
    hot_take: "Hot Take / POV",
  } as const)[mode];
}

function generalModeDirectives(mode: GeneralInputs["contentMode"]): string {
  switch (mode) {
    case "day_in_the_life": return "\n- Chronological structure with one anchoring 'why today' beat in the first 5s.";
    case "explainer": return "\n- Lead with the question. Earn the answer in steps. Avoid 'let's dive in' / 'today we're talking about' openers.";
    case "review": return "\n- State the bottom line in the first 5s. Body justifies. End with one specific recommendation.";
    case "tutorial": return "\n- Numbered steps. On-screen text mandatory. Pre-roll the finished result so viewer knows where they're going.";
    case "vlog": return "\n- One emotional through-line. Resist over-cutting. Sound design favors ambient over music bed.";
    case "hot_take": return "\n- Voice is contrarian, direct, allergic to platitudes." +
      "\n- Hooks must name the enemy (the cliché, the lazy take) in the first 3 seconds." +
      "\n- End with a sharp single-line conclusion, not a soft CTA.";
  }
}

function mapPlatform(p: NicheInputs["platform"]): PreShootInput["platform"] {
  if (p === "youtube_shorts") return "youtube_shorts";
  if (p === "youtube") return "youtube";
  if (p === "linkedin") return "linkedin";
  if (p === "all") return "all";
  return "instagram";
}
