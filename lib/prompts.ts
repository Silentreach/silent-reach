import type { PreShootInput, UserContext, VideoMeta } from "@/types";

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
      `THE USER'S VOICE — these are real captions/hooks the user has written before. Match this voice exactly: vocabulary, sentence length, rhythm, emoji policy, opening style, signature phrases. Do NOT default to generic LLM phrasings ("elevated," "stunning," "in today's market," "let's dive in").\n${numbered}`
    );
  }

  if (ctx.voiceNotes && ctx.voiceNotes.trim()) {
    parts.push(`Additional voice rules from the user (treat as binding):\n${ctx.voiceNotes.trim()}`);
  }

  if (ctx.brand) {
    const b = ctx.brand;
    const brandLines: string[] = [];
    if (b.name) brandLines.push(`Brand name: ${b.name}`);
    if (b.tagline) brandLines.push(`Tagline: ${b.tagline}`);
    if (b.primaryColor) brandLines.push(`Primary color: ${b.primaryColor}`);
    if (b.secondaryColor) brandLines.push(`Secondary color: ${b.secondaryColor}`);
    if (brandLines.length > 0) {
      parts.push(
        `BRAND CONTEXT — incorporate naturally where appropriate (e.g. thumbnail color guidance, sign-off, brand mention if user typically signs reels):\n${brandLines.join("\n")}`
      );
    }
  }

  if (parts.length === 0) return "";
  return `\n\n=== USER CONTEXT (highest-priority instructions, override defaults) ===\n${parts.join("\n\n")}\n=== END USER CONTEXT ===\n`;
}



export function buildPreShootPrompt(input: PreShootInput, ctx?: UserContext): {
  system: string;
  user: string;
} {
  const system = `You are a senior short-form video strategist working for Silent Story, a premium real estate and renovation video production business in Victoria, British Columbia, Canada. Your job is to turn a rough video concept into a precise pre-shoot brief that maximizes non-follower reach on Instagram, YouTube, LinkedIn, and Facebook.

Hard rules:
- Every hook must work in the first 3 seconds of the video. Assume the viewer is scrolling and has not followed the account.
- The shot list must be designed for retention, not beauty. Include at least one pattern interrupt in the first 4 seconds and a payoff moment 60-70% through the video.
- Titles must be under 60 characters and written in the voice of a local, trustworthy videographer - not a corporate marketer.
- Thumbnail direction names a specific moment in the video (not "add text saying wow"); it names the timestamp to grab the frame from, the overlay text (under 5 words), and the emotional tone.
- Local relevance notes must use actual Victoria BC neighborhoods, realtor board vocabulary, and terms homeowners in this market actually search.
- Return strict JSON matching the schema. No prose outside the JSON. No markdown fences.${userContextPreamble(ctx)}`;

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
${detailsLine}
Return only valid JSON matching this exact schema:

{
  "hooks": [
    { "type": "curiosity", "line": "string (max 12 words, read aloud as first 3 seconds of video)", "whyItWorks": "string (one sentence)" },
    { "type": "contrarian", "line": "string", "whyItWorks": "string" },
    { "type": "stakes", "line": "string", "whyItWorks": "string" }
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
  "localRelevanceNotes": ["string", "string", "string"]
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
- Return strict JSON matching the schema. No prose outside the JSON. No markdown fences.${userContextPreamble(ctx)}`;

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
