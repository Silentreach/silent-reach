import type { PreShootInput, VideoMeta } from "@/types";

export function buildPreShootPrompt(input: PreShootInput): {
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
- Return strict JSON matching the schema. No prose outside the JSON. No markdown fences.`;

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
): { system: string; user: string } {
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
- Thumbnail recommendation: look at the attached thumbnail image. Describe what's working, what's not, suggest a 3-word overlay text, suggest an alternative composition, and name the mood the thumbnail should evoke. Be specific — reference actual visual elements you see.
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
    "overlayText": "string (under 5 words, the text overlay that would lift CTR)",
    "compositionNotes": "string (alternative framing or composition suggestion, 1-2 sentences)",
    "moodDirection": "string (the emotional tone the thumbnail should evoke — one phrase)"
  }
}`;

  return { system, user };
}
