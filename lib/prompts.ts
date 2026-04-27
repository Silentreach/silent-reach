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
      `Match this user's voice exactly in every output string (vocabulary, rhythm, emoji policy, sentence length). Avoid generic LLM phrasings like \"elevated\", \"stunning\", \"in today's market\", \"let's dive in\". Their real samples:\n${numbered}`
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
Voice: editorial, quiet-luxury, never salesy. Never \"stunning\" / \"elevated\" / \"you won\u2019t believe.\"

Hooks (5, all under 12 words, must work without sound):
- curiosity: names a specific number/name/detail the video answers
- contrarian: reverses a default belief the audience holds
- stakes: names what they lose or gain
- voyeur: implies they\u2019re seeing something usually private
- transformation: promises a before/after they can\u2019t look away from
Each whyItWorks = ONE sentence naming the psychological mechanism.

Shot list: timestamps + descriptions + retentionNote on most shots. Pattern interrupt within first 4s. Payoff at 60-70%. Last 2s loops or asks a comment-bait question.

bRollList (3-5): secondary shots to also grab on site. Include at least one ambient sound cue.

filmingNotes: gear, lighting, timeOfDay, soundCapture, riskCalls.

openerVariants (exactly 2): two alt first-3-seconds approaches. line + one-word feel (warm/punchy/patient/cinematic).

Titles (3-5, under 60 chars): voice of a local trustworthy videographer.

thumbnailDirection: exact timestamp + overlay text under 5 words in caps + emotional tone (2-3 words).

localRelevanceNotes: actual neighborhoods (Oak Bay, James Bay, Fairfield, Cordova Bay, Saanich, Esquimalt), realtor vocab (VREB, MLS), homeowner search terms.

successChecks (2-3 yes/no questions).

OUTPUT: strict JSON matching the schema. Every required field present. No prose outside JSON. No markdown fences. JSON only.`;

  const detailsLine = input.details ? `Additional project details: ${input.details}\n` : "";

  const user = `Generate a pre-shoot brief for this video concept.

Content type: ${input.contentType}
Target audience: ${input.targetAudience}
Location context: ${input.location}
Target video length: ${input.videoLength}
Primary platform: ${input.platform}
Concept: ${input.concept}
${input.series ? `Series / project: ${input.series}\n` : ""}${detailsLine}${userContextPreamble(ctx)}

Return only valid JSON matching this exact schema. Every required field must be present.

{
  "hooks": [
    { "type": "curiosity", "line": "string", "whyItWorks": "string" },
    { "type": "contrarian", "line": "string", "whyItWorks": "string" },
    { "type": "stakes", "line": "string", "whyItWorks": "string" },
    { "type": "voyeur", "line": "string", "whyItWorks": "string" },
    { "type": "transformation", "line": "string", "whyItWorks": "string" }
  ],
  "shotList": [
    { "timestamp": "0-3s", "shot": "string", "retentionNote": "string" }
  ],
  "titleOptions": ["string", "string", "string", "string", "string"],
  "thumbnailDirection": { "momentTimestamp": "string", "overlayText": "string", "emotionalTone": "string" },
  "pitch": "string",
  "localRelevanceNotes": ["string", "string", "string"],
  "bRollList": [{ "shot": "string", "whyItHelps": "string" }],
  "filmingNotes": { "gear": "string", "lighting": "string", "timeOfDay": "string", "soundCapture": "string", "riskCalls": "string" },
  "openerVariants": [{ "line": "string", "feel": "string" }, { "line": "string", "feel": "string" }],
  "successChecks": ["string", "string", "string"]
}`;

  return { system, user };
}

export function buildPostUploadPrompt(
  meta: VideoMeta,
  transcript: string,
  overrides: { audience?: string; location?: string; visualContext?: string }
, ctx?: UserContext): { system: string; user: string } {
  const hasTranscript = transcript.trim().length > 50;

  const system = `You are a senior post-production content strategist working for Silent Story, a real estate and renovation video production business in Victoria, British Columbia, Canada. A YouTube video has just been uploaded. Your job is to generate a full content pack that maximizes non-follower reach across Instagram, YouTube, LinkedIn, and Facebook.

IMPORTANT: Silent Story produces cinematic real estate reels, listing films, and developer features. Most videos have NO spoken narration — they are visual, music-driven pieces. Your captions and copy must be written FROM THE VISUAL STORY, not from dialogue. You will see the video's thumbnail as an attached image — use it as your primary visual cue.

Hard rules:
- Voice of a thoughtful, grounded videographer. Never hype. Never salesy.
- Instagram caption: hook in first line, max 3 line breaks before truncation, 0-3 emojis, low-pressure CTA.
- LinkedIn post: \"here's what I noticed while filming this\" voice, three short paragraphs + one bullet list, no emojis, ends with a question.
- Facebook post: conversational, 3-5 sentences, includes the YouTube link at top.
- Title A/B variants: 5 options under 60 chars.
- Hook rewrites: for voice-less videos, treat as the first 3 SECONDS of visual content (e.g., \"Tight on hand placing a key on quartz counter — cut to wide\").
- Chapter markers: ONLY if video > 90s AND transcript provided. Otherwise empty array.
- Shareable clips: suggest 3 moments (10-20 second ranges).
- Suggested tags: 8-12 tags, lowercase, no \"#\" symbol.
- Thumbnail recommendation: look at the attached thumbnail and suggest an upgrade. Cover currentStrengths, currentWeaknesses, overlayText (3-5 words), compositionNotes, moodDirection, typography (specific named font like 'Playfair Display Black' or 'Barlow Condensed SemiBold', weightAndCase, colorAndTreatment with hex, positioning), design (colorPalette as 2-4 hex codes, backgroundTreatment, accentElements, aspectNotes). Default to editorial real-estate aesthetics: serif display fonts (Playfair, Cormorant, Bodoni) OR impact condensed sans (Barlow Condensed, Bebas Neue), generous letter-spacing, warm off-white or gold text over darkened hero shot, two-tone palette anchored to gold #D4AF37.
- Return strict JSON. No prose outside the JSON. No markdown fences.`;

  const audience = overrides.audience || "Victoria BC real estate agents, renovation homeowners, and contractors";
  const location = overrides.location || "Victoria BC, Canada";
  const visualContext = overrides.visualContext?.trim() || "";

  const transcriptBlock = hasTranscript
    ? `Transcript (with [MM:SS] timestamps):\n${transcript}`
    : "Transcript: NONE — generate all copy from the thumbnail image, title, description, and visual context provided";

  const contextBlock = visualContext
    ? `Creator's visual context: ${visualContext}`
    : "Creator's visual context: not provided";

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

The video's thumbnail is attached as an image.

${userContextPreamble(ctx)}

Return only valid JSON matching this exact schema:

{
  "instagramCaption": "string",
  "linkedInPost": "string",
  "facebookPost": "string",
  "titleVariants": ["string", "string", "string", "string", "string"],
  "hookRewrites": [
    { "line": "string", "worksBestFor": "string" },
    { "line": "string", "worksBestFor": "string" },
    { "line": "string", "worksBestFor": "string" }
  ],
  "chapterMarkers": [{ "timestamp": "0:00", "title": "string" }],
  "shareableClips": [
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" }
  ],
  "suggestedTags": ["string", "string", "string", "string", "string", "string", "string", "string"],
  "thumbnailRecommendation": {
    "currentStrengths": "string",
    "currentWeaknesses": "string",
    "overlayText": "string",
    "compositionNotes": "string",
    "moodDirection": "string",
    "typography": {
      "fontFamily": "string",
      "weightAndCase": "string",
      "colorAndTreatment": "string",
      "positioning": "string"
    },
    "design": {
      "colorPalette": ["#hex1", "#hex2", "#hex3"],
      "backgroundTreatment": "string",
      "accentElements": "string",
      "aspectNotes": "string"
    }
  }
}`;

  return { system, user };
}

export function buildReelMultiplierPrompt(
  input: ReelMultiplierInput,
  ctx?: UserContext
): { system: string; user: string } {
  const system = `You are a senior multi-platform reel producer for Silent Story (premium real estate + renovation video, Victoria BC). The user uploaded a short source video. You're seeing 6 frames sampled at evenly spaced timestamps. Your job: generate THREE distinct, platform-native reel packages — Instagram Reel, YouTube Short, Facebook Reel — that the user can ship within an hour.

Platform reality (treat as binding):
- Instagram Reel: max 60s, ideal 28-32s. Hook in first 1.5s. Caption is hook-first, max 2 emoji, 8-12 hashtags including 3-5 niche-specific ones.
- YouTube Short: max 60s, ideal 28-32s. Title required (under 60 chars). Description supports chapter timestamps. Hashtags 4-8.
- Facebook Reel: max 90s, ideal 28-30s. Caption tone slightly more conversational than IG.

Cut craft (HARD RULES — read carefully):
- Each package gets cutMarkers — non-overlapping startSec/endSec ranges into the source video — that get STITCHED in order to form the final reel.
- HARD CAP on total stitched length: IG 25-30s, YT 28-32s, FB 26-30s. Target ~30 seconds — that's the sweet spot where reels can build a payoff arc without losing retention.
- These cuts must be HIGHLIGHTS, not a chronological trim. Pick the most visually arresting moments scattered across the source — drone reveal, cleanest detail shot, biggest payoff, transition that says \"wait, look\". Skip anything that doesn't earn its second.
- DO NOT just chunk the video into sequential 8-10 second segments. Pick from across the timeline, not in order.
- Each cut should be 5-8 seconds. Use 4-5 cuts per platform — too few feels static, too many feels frantic at this length.
- Different platforms get DIFFERENT cuts. Don't triplicate the same edit.
- IG: fast, hook moment in first 1.5s, 4-5 punchy cuts of 5-7s each
- YT: setup-then-payoff arc. First cut establishes the place, last cut delivers the wow. 4-5 cuts of 6-8s
- FB: slightly looser, can lead with context. 4 cuts of 6-8s

Hooks:
- hookLine = the first 3 seconds overlay text. Under 8 words. Works without sound.

Captions per platform:
- Match the user's voice (see Writer context if provided)
- IG: hook-first, short paragraphs, 1-2 emoji max, end with a CTA question
- YT: longer description with chapter timestamps if useful
- FB: conversational, can be longer, emoji optional

Hashtags:
- 8-12 for IG
- 4-8 for YT (no spam, no #shorts repetition)
- 6-10 for FB

Thumbnail moments (2-3 per package):
- For each, name a specific timestamp in the source video, the overlay text (under 5 words, caps), and WHY this frame stops the scroll
- Different timestamps for different platforms

Music suggestions (2 per package):
- Describe mood, genre, BPM range, instrumentation
- Provide a searchQuery the user can paste into Epidemic Sound, Artlist, or YouTube Audio Library
- Note licensing path: in-app catalog (IG/FB) or licensed source (YT)
- Never name a copyrighted track unless royalty-free or in the platform's licensed library

Posting time:
- One window per platform + one-sentence rationale

First comment (one per package):
- A pre-written first comment the user drops the moment they post.

OUTPUT: strict JSON, exactly 3 packages in this order: instagram_reel, youtube_short, facebook_reel. No prose outside JSON. No markdown fences.`;

  const dur = Math.round(input.sourceDurationSec);
  const desc = input.description?.trim();
  const series = input.series?.trim();

  const user = `Source video duration: ${dur} seconds.${
    desc ? `\nCreator description: ${desc}` : ""
  }${series ? `\nSeries / project: ${series}` : ""}

Frames attached above in order (frame 1 = opener, frame 4 = payoff).

Return JSON in this exact shape:

{
  "source": { "durationSec": ${dur}, "description": ${JSON.stringify(desc || "")} },
  "packages": [
    {
      "platform": "instagram_reel",
      "hookLine": "string (≤8 words, first 3s overlay)",
      "caption": "string (IG-tuned, hook-first, max 2 emoji)",
      "hashtags": ["string", "string", "string", "string", "string", "string", "string", "string"],
      "cutMarkers": [{ "startSec": 0, "endSec": 30, "reason": "string" }],
      "thumbnailMoments": [
        { "timestampSec": 0, "overlayText": "STRING <5 WORDS", "reason": "string" }
      ],
      "musicSuggestions": [
        { "mood": "string", "genre": "string", "bpm": 0, "instrumentation": "string", "similarTo": "string", "searchQuery": "string", "licensingNote": "string" }
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
  "globalNotes": "string",
  "musicLicensingNote": "string"
}${userContextPreamble(ctx)}

Return only valid JSON. No prose. No markdown fences.`;

  return { system, user };
}
