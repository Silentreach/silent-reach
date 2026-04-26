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
        type: z.enum(["curiosity", "contrarian", "stakes", "voyeur", "transformation"]),
        line: z.string(),
        whyItWorks: z.string(),
      })
    )
    .min(3)
    .max(5),
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
  /* Optional enrichments — all backward-compatible. Old briefs in history still parse. */
  bRollList: z
    .array(z.object({ shot: z.string(), whyItHelps: z.string().optional() }))
    .optional(),
  filmingNotes: z
    .object({
      gear: z.string().optional(),
      lighting: z.string().optional(),
      timeOfDay: z.string().optional(),
      soundCapture: z.string().optional(),
      riskCalls: z.string().optional(),
    })
    .optional(),
  openerVariants: z
    .array(z.object({ line: z.string(), feel: z.string() }))
    .optional(),
  successChecks: z.array(z.string()).optional(),
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

  // Try strict parse first
  const first = PreShootOutputSchema.safeParse(json);
  if (first.success) return first.data as PreShootOutput;

  // One automated repair attempt: tell Claude exactly what's missing and ask for the same JSON back, fixed.
  const repairUser = `Your previous response failed schema validation. Here is the validation error:

${JSON.stringify(first.error.flatten(), null, 2)}

Here is the previous JSON you returned:

${JSON.stringify(json, null, 2)}

Return the EXACT same content, but with every required field present. Add nothing, remove nothing, just fill in the missing or invalid fields. Output only valid JSON, no prose, no markdown fences.`;
  const repaired = await callClaude(system, repairUser);
  const repairedJson = extractJson(repaired);
  const second = PreShootOutputSchema.safeParse(repairedJson);
  if (second.success) return second.data as PreShootOutput;

  // Last-resort backfill: fill missing whyItWorks / fields with sensible defaults so the user gets SOMETHING.
  // Better to hand them a brief that's 95% perfect than throw.
  const filled = backfillPreShoot(json as Record<string, unknown>);
  const third = PreShootOutputSchema.safeParse(filled);
  if (third.success) return third.data as PreShootOutput;

  // Truly broken — surface a clean error the page can show as friendly UX.
  throw new Error("The brief generator returned an output we couldn\u2019t fully parse. Please try again — the model occasionally drops a field, and a regenerate almost always fixes it.");
}

/* Defensive backfill: fills the most common missing fields so old broken briefs
   still surface to the user instead of throwing. Only fires after BOTH strict
   parse + auto-repair have failed. */
function backfillPreShoot(obj: Record<string, unknown>): Record<string, unknown> {
  const next = { ...obj } as Record<string, unknown>;
  const hooks = Array.isArray(next.hooks) ? (next.hooks as Array<Record<string, unknown>>) : [];
  next.hooks = hooks.map((h) => ({
    type: typeof h.type === "string" ? h.type : "curiosity",
    line: typeof h.line === "string" ? h.line : "(missing hook line)",
    whyItWorks: typeof h.whyItWorks === "string" ? h.whyItWorks : "Drives curiosity in the first 3 seconds.",
  }));
  if (!Array.isArray(next.shotList)) next.shotList = [];
  if (!Array.isArray(next.titleOptions) || next.titleOptions.length < 3) {
    next.titleOptions = (next.titleOptions as string[] | undefined ?? []).concat(["Untitled", "Untitled", "Untitled"]).slice(0, 3);
  }
  if (typeof next.pitch !== "string") next.pitch = "(pitch unavailable — please regenerate)";
  if (!Array.isArray(next.localRelevanceNotes)) next.localRelevanceNotes = [];
  if (!next.thumbnailDirection || typeof next.thumbnailDirection !== "object") {
    next.thumbnailDirection = { momentTimestamp: "0:00", overlayText: "", emotionalTone: "" };
  }
  return next;
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
