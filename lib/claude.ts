import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildPreShootPrompt, buildPostUploadPrompt } from "./prompts";
import { extractJson } from "./utils";
import type {
  PreShootInput,
  PreShootOutput,
  PostUploadOutput,
  UserContext,
  VideoMeta,
} from "@/types";

const MODEL = "claude-sonnet-4-5"; // Update if Anthropic deprecates this ID. Check https://docs.anthropic.com/en/docs/about-claude/models

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
    .array(z.object({ line: z.string(), worksBestFor: z.string() }))
    .min(1),
  chapterMarkers: z.array(z.object({ timestamp: z.string(), title: z.string() })),
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
  thumbnailRecommendation: z.object({
    currentStrengths: z.string(),
    currentWeaknesses: z.string(),
    overlayText: z.string(),
    compositionNotes: z.string(),
    moodDirection: z.string(),
    typography: z.object({
      fontFamily: z.string(),
      weightAndCase: z.string(),
      colorAndTreatment: z.string(),
      positioning: z.string(),
    }),
    design: z.object({
      colorPalette: z.array(z.string()).min(2),
      backgroundTreatment: z.string(),
      accentElements: z.string(),
      aspectNotes: z.string(),
    }),
  }),
});

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment");
  return new Anthropic({ apiKey });
}

type ImageContent = {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

async function callClaude(
  system: string,
  user: string,
  image?: ImageContent
): Promise<string> {
  const client = getClient();
  type ImageBlock = {
    type: "image";
    source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
  };
  type TextBlock = { type: "text"; text: string };
  const userContent: (ImageBlock | TextBlock)[] = [];
  if (image) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.data,
      },
    });
  }
  userContent.push({ type: "text", text: user });
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.7,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  const block = resp.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  return block.text;
}

export async function generatePreShoot(
  input: PreShootInput,
  ctx?: UserContext
): Promise<PreShootOutput> {
  const { system, user } = buildPreShootPrompt(input, ctx);
  const raw = await callClaude(system, user);
  const json = extractJson(raw);
  return PreShootOutputSchema.parse(json) as PreShootOutput;
}

export async function generatePostUpload(
  meta: VideoMeta,
  transcript: string,
  overrides: { audience?: string; location?: string; visualContext?: string },
  thumbnailImage?: ImageContent,
  ctx?: UserContext
): Promise<PostUploadOutput> {
  const { system, user } = buildPostUploadPrompt(meta, transcript, overrides, ctx);
  const raw = await callClaude(system, user, thumbnailImage);
  const json = extractJson(raw);
  return PostUploadOutputSchema.parse(json) as PostUploadOutput;
}
