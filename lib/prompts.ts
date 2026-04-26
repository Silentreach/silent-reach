import type { PreShootInput, ReelMultiplierInput, UserContext, VideoMeta } from "@/types";

/* ───────── User-context preamble (voice + brand) ───────── */

function userContextPreamble(ctx?: UserContext): string {
  if (!ctx) return "";
  const parts: string[] = [];

  if (ctx.voiceSamples && ctx.voiceSamples.length > 0) {
    const numbered = ctx.voiceSamples
      .slice(0, 8)
      .map((s, i) => `  ${i + 1}. ${s.trim()}`)
      .join("\n");
    parts.push(
      `Match this user's voice exactly in every output string (vocabulary, rhythm, emoji policy, sentence length). Avoid generic LLM phrasings like "elevated", "stunning", "in today's market", "let's dive in". Their real samples:\n${numbered}`
    );
  }

  if (ctx.voiceNotes && ctx.voiceNotes.trim()) {
    parts.push(`Additional voice rules (treat as binding):\n${ctx.voiceNotes.trim()}`);
  }

  if (ctx.brand) {
    const b = ctx.brand;
    const brandLines: string[] = [];
    if (b.name) brandLines.push(`Brand name: ${b.name}`);
    if (b.tagline) brandLines.push(`Tagline: ${b.tagline}`);
    if (b.primaryColor) brandLines.push(`Primary color: ${b.primaryColor}`);
    if (b.secondaryColor) brandLines.push(`Secondary color: ${b.secondaryColor}`);
    if (brandLines.length > 0) {
      parts.push(`Brand context (apply where natural — thumbnail palette, sign-offs):\n${brandLines.join("\n")}`);
    }
  }

  if (parts.length === 0) return "";
  return `\n\nWriter context for this user:\n${parts.join("\n\n")}`;
}



export function buildPreShootPrompt(input: PreShootInput, ctx?: UserContext): {
  system: string;
  user: string;
} {
  const system = `You are a senior short-form video strategist for Silent Story (premium real estate + renovation video, Victoria BC). Your output decides whether a reel hits 5K views or 50K. Treat it that way.

Audience: scrolling, not following you, gives 1.5s. Drop-off cliffs at 3s, 8s, 15s, 30s — every shot serves the next cliff.
Voice: editorial, quiet-luxury, never salesy. Never "stunning" / "elevated" / "you won\u2019t believe."

Hooks (5, all under 12 words, must work without sound):
- curiosity: names a specific number/name/detail the video answers
- contrarian: reverses a default belief the audience holds
- stakes: names what they lose or gain
- voyeur: implies they\u2019re seeing something usually private
- transformation: promises a before/after they can\u2019t look away from
Each whyItWorks = ONE sentence naming the psychological mechanism.

Shot list: timestamps + descriptions + retentionNote on most shots. Pattern interrupt within first 4s. Payoff at 60-70%. Last 2s loops or asks a comment-bait question.

bRollList (3-5): secondary shots to also grab on site (doorknob, light through curtains, kettle, long pull-back, agent looking at listing). Include at least one ambient sound cue.

filmingNotes: gear (gimbal/drone/phone), lighting (natural / supplement / golden hour), timeOfDay (best window), soundCapture (ambient cues to record), riskCalls (1-2 things that kill the reel if not nailed).

openerVariants (exactly 2): two alt first-3-seconds approaches to film both & A/B in editing. line + one-word feel (warm/punchy/patient/cinematic).

Titles (3-5, under 60 chars): voice of a local trustworthy videographer. Not corporate. Not clickbait.

thumbnailDirection: exact timestamp + overlay text under 5 words in caps + emotional tone (2-3 words).

localRelevanceNotes: actual neighborhoods (Oak Bay, James Bay, Fairfield, Cordova Bay, Saanich, Esquimalt), realtor vocab (VREB, MLS), homeowner search terms (BC speculation tax, garden suite zoning, Victoria heritage). Use the user\u2019s Location context above if non-Victoria.

successChecks (2-3 yes/no questions before publishing).

OUTPUT: strict JSON matching the schema. Every required field present. No prose outside JSON. No markdown fences. JSON only.`;

  const detailsLine = input.details
    ? `Additional project details: ${input.details}\n`
    : "";

  const user = `Generate a pre-shoot brief for this video concept.

Content type: ${input.contentType}
Target audience: ${input.targetAudience}
Location context: ${input.location}
Target video length: ${input.videoLength}
Primary platform: ${input.platform}
Concept: ${input.concept}
${input.series ? `Series / project: ${input.series} (this brief is one reel within a multi-reel project — match visual language and escalating stakes you'd expect from prior reels in the series)\n` : ""}${detailsLine}${userContextPreamble(ctx)}

Return only valid JSON matching this exact schema. Every required field must be present.

{
  "hooks": [
    { "type": "curiosity", "line": "string (\u226412 words, readable as first 3s of video)", "whyItWorks": "string (one sentence, names the psychological mechanism)" },
    { "type": "contrarian", "line": "string", "whyItWorks": "string" },
    { "type": "stakes", "line": "string", "whyItWorks": "string" },
    { "type": "voyeur", "line": "string", "whyItWorks": "string" },
    { "type": "transformation", "line": "string", "whyItWorks": "string" }
  ],
  "shotList": [
    { "timestamp": "0-3s", "shot": "string (what to film)", "retentionNote": "string (why this shot keeps viewers - optional)" }
  ],
  "titleOptions": ["string", "string", "string", "string", "string"],
  "thumbnailDirection": {
    "momentTimestamp": "string (e.g. 0:42)",
    "overlayText": "string (under 5 words)",
    "emotionalTone": "string (one phrase)"
  },
  "pitch": "string (2-3 sentences, plain language)",
  "localRelevanceNotes": ["string", "string", "string"],
  "bRollList": [
    { "shot": "string (specific secondary shot to also capture on site)", "whyItHelps": "string (one sentence)" }
  ],
  "filmingNotes": {
    "gear": "string (gimbal/drone/phone-or-camera call)",
    "lighting": "string (natural / supplement / golden hour window / risks)",
    "timeOfDay": "string (best window for THIS concept)",
    "soundCapture": "string (ambient cues to record)",
    "riskCalls": "string (1-2 things that kill the reel if not nailed)"
  },
  "openerVariants": [
    { "line": "string (alt opener line — film both)", "feel": "string (one word: warm/punchy/patient/cinematic)" },
    { "line": "string", "feel": "string" }
  ],
  "successChecks": ["string (yes/no quality check)", "string", "string"]
}

Rules for the shot list:
- 5-8 items total
- Timestamps must add up to roughly the target video length
- First shot must start at 0-3s and be a pattern interrupt
- Include a clear payoff shot at roughly 60-70% of video length
- Every shot should be filmable by one person with a gimbal and drone`;

  return { system, user };
}

export function buildPostUploadPrompt(
  meta: VideoMeta,
  transcript: string,
  overrides: { audience?: string; location?: string; visualContext?: string }
, ctx?: UserContext): { system: string; user: string } {
  const hasTranscript = transcript.trim().length > 50;

  const system = `You are a senior post-production content strategist working for Silent Story, a real estate and renovation video production business in Victoria, British Columbia, Canada. A YouTube video has just been uploaded. Your job is to generate a full content pack that maximizes non-follower reach across Instagram, YouTube, LinkedIn, and Facebook.

IMPORTANT: Silent Story produces cinematic real estate reels, listing films, and developer features. Most videos have NO spoken narration — they are visual, music-driven pieces. Your captions and copy must be written FROM THE VISUAL STORY, not from dialogue. You will see the video's thumbnail as an attached image — use it as your primary visual cue, along with the title, description, and any user-provided visual context.

Hard rules:
- Write in the voice of a thoughtful, grounded videographer who respects his craft and his clients. Never hype. Never salesy.
- Instagram caption: hook in the first line (describes the mood or a visual detail, not dialogue), max 3 line breaks before truncation, emojis used sparingly (0-3 total), ends with a low-pressure CTA.
- LinkedIn post: "here's what I noticed while filming this" voice, three short paragraphs plus one bullet list, no emojis, ends with a question to drive comments.
- Facebook post: conversational, 3-5 sentences, includes the YouTube link at the top.
- Title A/B variants: 5 options under 60 characters each, covering at least one curiosity angle, one benefit angle, and one location-or-number-driven angle.
- Hook rewrites: for voice-less videos, treat these as the first 3 SECONDS of visual content — what the opening SHOT should be (e.g., "Tight on hand placing a key on quartz counter — cut to wide"). For videos with dialogue, write as spoken script lines.
- Chapter markers: ONLY generate if (a) the video is longer than 90 seconds AND (b) a transcript is provided with meaningful content. Otherwise return an empty array.
- Shareable clips: suggest 3 moments (10-20 second ranges) the creator could export as a Reel. For voice-less videos, suggest based on typical real estate reel structure (opening establishing shot, mid-film hero reveal, final payoff) expressed as timestamp ranges. Always provide 3.
- Suggested tags: 8-12 tags, lowercase, no "#" symbol.
- Thumbnail recommendation: look at the attached thumbnail image and suggest an upgrade that a designer could execute in Figma/Photoshop/Canva in 10 minutes. Cover: (a) what's currently working, (b) what's weak, (c) a 3-5 word overlay text, (d) alternative composition, (e) mood, (f) TYPOGRAPHY — specific font family (e.g. "Playfair Display Black" or "Barlow Condensed SemiBold"), weight + case (e.g. "All caps with 50 letter-spacing"), text color + treatment (e.g. "Off-white #F5F2E8 with 1px dark stroke and 12% opacity drop shadow"), and positioning (e.g. "Bottom-left third, 8% padding from edges"), (g) DESIGN — a 2-4 color palette as HEX codes (e.g. ["#0A1E2C", "#D4AF37", "#F5F2E8"]), background treatment (e.g. "Soft bottom-to-top vignette from black to transparent over the hero shot"), accent elements (small graphical touches like a thin gold underline, a location pin icon, or none), and aspect notes (YouTube 16:9 main thumbnail vs crop for Shorts). For Silent Story specifically, default to editorial real-estate aesthetics: serif display fonts (Playfair, Cormorant, Bodoni) OR impact condensed sans (Barlow Condensed, Bebas Neue), generous letter-spacing, warm off-white or gold text over darkened hero shot, two-tone palette anchored to Silent Story's gold #D4AF37 and a deep neutral. Never suggest generic "bold yellow text" without a specific named font and hex.
- Return strict JSON matching the schema. No prose outside the JSON. No markdown fences.`;

  const audience =
    overrides.audience ||
    "Victoria BC real estate agents, renovation homeowners, and contractors";
  const location = overrides.location || "Victoria BC, Canada";
  const visualContext = overrides.visualContext?.trim() || "";

  const transcriptBlock = hasTranscript
    ? `Transcript (with [MM:SS] timestamps):\n${transcript}`
    : "Transcript: NONE (this video has no spoken narration — generate all copy from the thumbnail image, title, description, and visual context provided)";

  const contextBlock = visualContext
    ? `Creator's visual context: ${visualContext}`
    : "Creator's visual context: not provided — rely on the thumbnail image and title/description";

  const user = `Video metadata:
Title: ${meta.title}
Channel: ${meta.channelTitle}
Duration: ${meta.durationSeconds} seconds
Published: ${meta.publishedAt}
Tags: ${meta.tags.join(", ")}
Description:
${meta.description}

Audience context: ${audience}
Location context: ${location}
${contextBlock}

${transcriptBlock}

The video's thumbnail is attached as an image. Use it as your primary visual reference.

${userContextPreamble(ctx)}

Return only valid JSON matching this exact schema:

{
  "instagramCaption": "string",
  "linkedInPost": "string",
  "facebookPost": "string",
  "titleVariants": ["string", "string", "string", "string", "string"],
  "hookRewrites": [
    { "line": "string (opening 3 seconds — shot description if no transcript, or spoken hook if transcript exists)", "worksBestFor": "string" },
    { "line": "string", "worksBestFor": "string" },
    { "line": "string", "worksBestFor": "string" }
  ],
  "chapterMarkers": [
    { "timestamp": "0:00", "title": "string" }
  ],
  "shareableClips": [
    { "startTimestamp": "string (e.g. 0:10)", "endTimestamp": "string (e.g. 0:25)", "whyItWorks": "string", "suggestedCaption": "string (under 200 chars)" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" }
  ],
  "suggestedTags": ["string", "string", "string", "string", "string", "string", "string", "string"],
  "thumbnailRecommendation": {
    "currentStrengths": "string (1-2 sentences — what's working in the current thumbnail)",
    "currentWeaknesses": "string (1-2 sentences — what's weak or could be stronger)",
    "overlayText": "string (3-5 words, the exact text overlay that would lift CTR)",
    "compositionNotes": "string (alternative framing or composition suggestion, 1-2 sentences)",
    "moodDirection": "string (the emotional tone the thumbnail should evoke — one phrase)",
    "typography": {
      "fontFamily": "string (specific named font with weight variant, e.g. 'Playfair Display Black' or 'Barlow Condensed SemiBold')",
      "weightAndCase": "string (e.g. 'All caps, 50 letter-spacing, 72pt')",
      "colorAndTreatment": "string (e.g. 'Off-white #F5F2E8 with 1px dark stroke and 12% opacity drop shadow')",
      "positioning": "string (e.g. 'Bottom-left third, 8% padding from left and bottom edges')"
    },
    "design": {
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "backgroundTreatment": "string (how to handle the hero image behind the text, e.g. 'Soft bottom-to-top vignette from black to transparent, -10 exposure on bottom third to let text breathe')",
      "accentElements": "string (small design touches, or 'none' if the photography should carry it alone)",
      "aspectNotes": "string (e.g. '16:9 for YouTube main thumbnail; consider center-weighted crop for IG Reel cover')"
    }
  }
}`;

  return { system, user };
}

/* ───────── Reel Multiplier prompt ─────────
   Given 6 video frames + creator context, generate 3 platform-tuned
   reel packages. Each platform gets distinct caption culture, length,
   pacing, hashtag conventions, and music guidance. */

export function buildReelMultiplierPrompt(
  input: ReelMultiplierInput,
  ctx?: UserContext
): { system: string; user: string } {
  const system = `You are a senior multi-platform reel producer for Silent Story (premium real estate + renovation video, Victoria BC). The user uploaded a short source video. You\u2019re seeing 6 frames sampled at evenly spaced timestamps. Your job: generate THREE distinct, platform-native reel packages — Instagram Reel, YouTube Short, Facebook Reel — that the user can ship within an hour.

Platform reality (treat as binding):
- Instagram Reel: max 60s, ideal 20-40s. Hook in first 1.5s. Caption is hook-first, max 2 emoji, 8-12 hashtags including 3-5 niche-specific ones. Music selection happens IN-APP from Meta\u2019s licensed catalog — your music suggestion describes mood/BPM so the user can find similar tracks there.
- YouTube Short: max 60s, ideal 30-50s. Title required (under 60 chars). Description supports chapter timestamps. Hashtags 4-8, no spam. Use YouTube Audio Library OR licensed source for music; can be embedded in pre-rendered video.
- Facebook Reel: max 90s, ideal 30-60s. Caption tone slightly more conversational than IG. Music from Meta catalog, same as IG.

Cut craft:
- Each package gets cutMarkers — startSec/endSec into the source video — that fit the platform\u2019s ideal length and pacing. Different platforms get DIFFERENT cuts. Don\u2019t triplicate the same edit.
- IG: faster cuts, hook moment in first 1.5s
- YT: can breathe more, set up a payoff moment at 60-70%
- FB: looser, slightly more contextual setup

Hooks:
- hookLine = the first 3 seconds overlay text. Under 8 words. Works without sound.

Captions per platform:
- Match the user\u2019s voice (see Writer context if provided)
- IG: hook-first, short paragraphs, 1-2 emoji max, end with a CTA question
- YT: longer description with chapter timestamps if useful
- FB: conversational, can be longer, emoji optional

Hashtags:
- 8-12 for IG (mix of broad, niche, ultra-niche)
- 4-8 for YT (no spam, no #shorts repetition — YT already knows it\u2019s a short)
- 6-10 for FB (slightly different culture, often local-region tags)

Thumbnail moments (3-5 per package):
- For each, name a specific timestamp in the source video, the overlay text (under 5 words, caps), and WHY this frame stops the scroll
- Different timestamps for different platforms — IG often wants energy, YT wants storytelling clarity, FB wants relatability

Music suggestions (2-4 per package):
- Describe the mood, genre, BPM range, instrumentation
- Provide a searchQuery the user can paste into Epidemic Sound, Artlist, or YouTube Audio Library
- Note the licensing path: in-app catalog (IG/FB) or licensed source (YT)
- Never name a copyrighted track unless it\u2019s explicitly royalty-free or in the platform\u2019s licensed library

Posting time:
- One window per platform (e.g. \"Tuesday 7-9pm PT\") + one-sentence rationale based on the audience (real estate buyers in Victoria BC, scrolling after dinner)

First comment (one per package):
- A pre-written first comment the user drops the moment they post. Should match user voice. Should bait engagement without sounding like bait.

OUTPUT: strict JSON, exactly 3 packages in this order: instagram_reel, youtube_short, facebook_reel. No prose outside JSON. No markdown fences.`;

  const dur = Math.round(input.sourceDurationSec);
  const desc = input.description?.trim();
  const series = input.series?.trim();

  const user = `Source video duration: ${dur} seconds.${
    desc ? `\nCreator description: ${desc}` : ""
  }${series ? `\nSeries / project: ${series}` : ""}

Frames are attached above in order (frame 1 = earliest, frame 6 = latest).

Return JSON in this exact shape:

{
  "source": { "durationSec": ${dur}, "description": ${JSON.stringify(desc || "")} },
  "packages": [
    {
      "platform": "instagram_reel",
      "hookLine": "string (\u22648 words, first 3s overlay)",
      "caption": "string (IG-tuned, hook-first, max 2 emoji)",
      "hashtags": ["string", "string", "string", "string", "string", "string", "string", "string"],
      "cutMarkers": [{ "startSec": 0, "endSec": 30, "reason": "string" }],
      "thumbnailMoments": [
        { "timestampSec": 0, "overlayText": "STRING <5 WORDS", "reason": "string" }
      ],
      "musicSuggestions": [
        { "mood": "string", "genre": "string", "bpm": 0, "instrumentation": "string", "similarTo": "string", "searchQuery": "string for in-app or external library search", "licensingNote": "string" }
      ],
      "postingTime": { "window": "string", "rationale": "string" },
      "firstComment": "string"
    },
    {
      "platform": "youtube_short",
      "title": "string (under 60 chars)",
      "hookLine": "string",
      "caption": "string (YT-tuned)",
      "description": "string (longer, optional chapter timestamps)",
      "hashtags": ["string", "string", "string", "string"],
      "cutMarkers": [{ "startSec": 0, "endSec": 0, "reason": "string" }],
      "thumbnailMoments": [
        { "timestampSec": 0, "overlayText": "string", "reason": "string" }
      ],
      "musicSuggestions": [
        { "mood": "string", "genre": "string", "bpm": 0, "instrumentation": "string", "similarTo": "string", "searchQuery": "string", "licensingNote": "string" }
      ],
      "postingTime": { "window": "string", "rationale": "string" },
      "firstComment": "string"
    },
    {
      "platform": "facebook_reel",
      "hookLine": "string",
      "caption": "string (FB-tuned, conversational)",
      "hashtags": ["string", "string", "string", "string", "string", "string"],
      "cutMarkers": [{ "startSec": 0, "endSec": 0, "reason": "string" }],
      "thumbnailMoments": [
        { "timestampSec": 0, "overlayText": "string", "reason": "string" }
      ],
      "musicSuggestions": [
        { "mood": "string", "genre": "string", "bpm": 0, "instrumentation": "string", "similarTo": "string", "searchQuery": "string", "licensingNote": "string" }
      ],
      "postingTime": { "window": "string", "rationale": "string" },
      "firstComment": "string"
    }
  ],
  "globalNotes": "string (anything that applies to all 3 packages, e.g. consistent visual language across platforms)",
  "musicLicensingNote": "string (one short paragraph reminding the creator: in-app music for IG/FB plays nice with the algorithm; for YT pre-rendered embeds use YouTube Audio Library or a licensed catalog like Epidemic Sound; never embed copyrighted commercial tracks)"
}${userContextPreamble(ctx)}

Return only valid JSON. No prose. No markdown fences.`;

  return { system, user };
}

