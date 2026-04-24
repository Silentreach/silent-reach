import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildPreShootPrompt, buildPostUploadPrompt } from "./prompts";
import { extractJson } from "./utils";
import type {
  PreShootInput,
  PreShootOutput,
  PostUploadOutput,
  VideoMeta,
} from "@/types";

const MODEL = "claude-sonnet-4-5"; // Update to "claude-sonnet-4-5-20250929" or newer if this ID is deprecated. Check https://docs.anthropic.com/en/docs/about-claude/models

// Schemas for runtime validation
const PreShootOutputSchema = z.object({
  hooks: z
    .array(
      z.object({
        type: z.enum(["curiosity", "contrarian", "stakes"]),
        line: z.string(),
        whyItWorks: z.string(),
      })
    )
    .min(3)
    .max(3),
  shotList: z
    .array(
      z.object({
        timestamp: z.string(),
        shot: z.string(),
        retentionNote: z.string().optional(),
      })
    )
    .min(3),
  titleOptions: z.array(z.string()).min(3),
  thumbnailDirection: z.object({
    momentTimestamp: z.string(),
    overlayText: z.string(),
    emotionalTone: z.string(),
  }),
  pitch: z.string(),
  localRelevanceNotes: z.array(z.string()),
});

const PostUploadOutputSchema = z.object({
  instagramCaption: z.string(),
  linkedInPost: z.string(),
  facebookPost: z.string(),
  titleVariants: z.array(z.string()).min(3),
  hookRewrites: z
    .array(
      z.object({
        line: z.string(),
        worksBestFor: z.string(),
      })
    )
    .min(1),
  chapterMarkers: z.array(
    z.object({
      timestamp: z.string(),
      title: z.string(),
    })
  ),
  shareableClips: z
    .array(
      z.object({
        startTimestamp: z.string(),
        endTimestamp: z.string(),
        whyItWorks: z.string(),
        suggestedCaption: z.string(),
      })
    )
    .min(1),
  suggestedTags: z.array(z.string()),
});

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment");
  }
  return new Anthropic({ apiKey });
}

async function callClaude(system: string, user: string): Promise<string> {
  const client = getClient();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = resp.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected Claude response type");
  }
  return block.text;
}

export async function generatePreShoot(
  input: PreShootInput
): Promise<PreShootOutput> {
  const { system, user } = buildPreShootPrompt(input);
  const raw = await callClaude(system, user);
  const json = extractJson(raw);
  return PreShootOutputSchema.parse(json) as PreShootOutput;
}

export async function generatePostUpload(
  meta: VideoMeta,
  transcript: string,
  overrides: { audience?: string; location?: string }
): Promise<PostUploadOutput> {
  const { system, user } = buildPostUploadPrompt(meta, transcript, overrides);
  const raw = await callClaude(system, user);
  const json = extractJson(raw);
  return PostUploadOutputSchema.parse(json) as PostUploadOutput;
}
