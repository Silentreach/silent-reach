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
  overrides: { audience?: string; location?: string }
): { system: string; user: string } {
  const system = `You are a senior post-production content strategist working for Silent Story, a real estate and renovation video production business in Victoria, British Columbia, Canada. A YouTube video has just been uploaded. Your job is to generate a full content pack that maximizes non-follower reach across Instagram, YouTube, LinkedIn, and Facebook - all derived from the video's transcript, title, and description.

Hard rules:
- Write in the voice of a thoughtful, grounded videographer who respects his craft and his clients. Never hype. Never salesy.
- Instagram caption: hook in the first line, max 3 line breaks before the truncation, emojis used sparingly (0-3 total), ends with a low-pressure CTA.
- LinkedIn post: "here's what I learned" voice, three short paragraphs plus one bullet list, no emojis, ends with a question to drive comments.
- Facebook post: conversational, 3-5 sentences, includes the YouTube link at the top.
- Title A/B variants: 5 options under 60 characters each, covering at least one curiosity angle, one benefit angle, and one number-driven angle.
- Hook rewrites: what could the first 3 seconds have said? Write them as script lines (spoken aloud), not captions.
- Chapter markers: ONLY generate if the video is longer than 90 seconds. For shorter videos, return an empty array.
- Shareable clips: find the 3 most scroll-stopping 10-20 second moments in the transcript, with start and end timestamps from the transcript timing.
- Suggested tags: 8-12 tags, lowercase, no "#" symbol. Not a headline feature.
- Return strict JSON matching the schema. No prose outside the JSON. No markdown fences.`;

  const audience =
    overrides.audience ||
    "Victoria BC real estate agents, renovation homeowners, and contractors";
  const location = overrides.location || "Victoria BC, Canada";

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

Transcript (with [MM:SS] timestamps):
${transcript}

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
  "chapterMarkers": [
    { "timestamp": "0:00", "title": "string" }
  ],
  "shareableClips": [
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" },
    { "startTimestamp": "string", "endTimestamp": "string", "whyItWorks": "string", "suggestedCaption": "string" }
  ],
  "suggestedTags": ["string", "string", "string", "string", "string", "string", "string", "string"]
}`;

  return { system, user };
}
