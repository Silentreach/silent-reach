export type ContentType =
  | "listing_tour"
  | "renovation_walkthrough"
  | "before_after"
  | "contractor_feature"
  | "explainer"
  | "other";

export type Platform = "instagram" | "youtube" | "youtube_shorts" | "linkedin" | "all";

export type VideoLength = "15s" | "30s" | "60s" | "90s" | "3-5min" | "5-10min";

export interface PreShootInput {
  contentType: ContentType;
  targetAudience: string;
  location: string;
  videoLength: VideoLength;
  platform: Platform;
  concept: string;
  details?: string;
  /** Optional series/project name. Groups multi-reel projects in History
      and gives Claude continuity context across briefs in the same series. */
  series?: string;
}

export interface Hook {
  type: "curiosity" | "contrarian" | "stakes" | "voyeur" | "transformation";
  line: string;
  whyItWorks: string;
}

export interface ShotListItem {
  timestamp: string;
  shot: string;
  retentionNote?: string;
}

export interface ThumbnailDirection {
  momentTimestamp: string;
  overlayText: string;
  emotionalTone: string;
}

export interface BRollItem { shot: string; whyItHelps?: string; }
export interface FilmingNotes {
  gear?: string;
  lighting?: string;
  timeOfDay?: string;
  soundCapture?: string;
  riskCalls?: string;
}
export interface OpenerVariant { line: string; feel: string; }

export interface PreShootOutput {
  hooks: Hook[];
  shotList: ShotListItem[];
  titleOptions: string[];
  thumbnailDirection: ThumbnailDirection;
  pitch: string;
  localRelevanceNotes: string[];
  /* World-class enrichments — all optional, backward-compatible. */
  bRollList?: BRollItem[];
  filmingNotes?: FilmingNotes;
  openerVariants?: OpenerVariant[];
  successChecks?: string[];
}

export interface PostUploadInput {
  youtubeUrl: string;
  audienceOverride?: string;
  locationOverride?: string;
  visualContext?: string;
  manualTranscript?: string;
}

export interface ThumbnailTypography {
  fontFamily: string;
  weightAndCase: string;
  colorAndTreatment: string;
  positioning: string;
}

export interface ThumbnailDesign {
  colorPalette: string[];
  backgroundTreatment: string;
  accentElements: string;
  aspectNotes: string;
}

export interface ThumbnailRecommendation {
  currentStrengths: string;
  currentWeaknesses: string;
  overlayText: string;
  compositionNotes: string;
  moodDirection: string;
  typography: ThumbnailTypography;
  design: ThumbnailDesign;
}

export interface HookRewrite {
  line: string;
  worksBestFor: string;
}

export interface ChapterMarker {
  timestamp: string;
  title: string;
}

export interface ShareableClip {
  startTimestamp: string;
  endTimestamp: string;
  whyItWorks: string;
  suggestedCaption: string;
}

export interface PostUploadOutput {
  instagramCaption: string;
  linkedInPost: string;
  facebookPost: string;
  titleVariants: string[];
  hookRewrites: HookRewrite[];
  chapterMarkers: ChapterMarker[];
  shareableClips: ShareableClip[];
  suggestedTags: string[];
  thumbnailRecommendation: ThumbnailRecommendation;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  duration: string;
  durationSeconds: number;
  publishedAt: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export type HistoryItem =
  | {
      kind: "brief";
      id: string;
      createdAt: string;
      input: PreShootInput;
      output: PreShootOutput;
    }
  | {
      kind: "pack";
      id: string;
      createdAt: string;
      input: PostUploadInput;
      meta: VideoMeta;
      output: PostUploadOutput;
    };

/* ───────── User context (voice + brand kit) ─────────
   Stored in browser localStorage. Sent to API on each generation
   so prompts can match the user's voice and brand identity. */

export interface UserContext {
  voiceSamples?: string[];           // 0–8 short captions/hooks the user wrote
  voiceNotes?: string;               // free-form rules ("never use 'elevated'")
  brand?: {
    name?: string;
    tagline?: string;
    primaryColor?: string;           // hex e.g. #d4af37
    secondaryColor?: string;
    logoDataUrl?: string;            // small data URL (resized)
  };
}

/* ───────── Reel Multiplier — v1 ─────────
   Upload one source video, get three platform-tuned reel packages
   (Instagram Reel, YouTube Short, Facebook Reel) — each with its own
   cut markers, captions, hashtags, music suggestions, posting time. */

export type ReelPlatform = "instagram_reel" | "youtube_short" | "facebook_reel";

export interface ReelCutMarker {
  startSec: number;
  endSec: number;
  reason?: string;
}

export interface ReelThumbnailMoment {
  timestampSec: number;
  overlayText: string;
  reason: string;
}

export interface ReelMusicSuggestion {
  mood: string;            // e.g. "warm acoustic"
  genre: string;           // e.g. "ambient folk"
  bpm?: number;            // approximate beats per minute
  instrumentation: string; // e.g. "fingerpicked acoustic guitar + light piano"
  similarTo?: string;      // a referent (artist or track type)
  searchQuery: string;     // for use against Epidemic Sound / Artlist / YouTube Audio Library
  licensingNote?: string;  // short reminder per source
}

export interface ReelPostingTime {
  window: string;          // e.g. "Tuesday 7-9pm PT"
  rationale: string;       // why this window
}

export interface ReelPackage {
  platform: ReelPlatform;
  title?: string;          // YouTube Short needs a title; IG/FB don't
  hookLine: string;        // first 3 seconds overlay text
  caption: string;         // platform-tuned caption body
  description?: string;    // YouTube long form, optional for others
  hashtags: string[];      // 8-12 platform-appropriate hashtags
  cutMarkers: ReelCutMarker[];
  thumbnailMoments: ReelThumbnailMoment[];   // 3-5 candidates
  musicSuggestions: ReelMusicSuggestion[];    // 2-4 suggestions
  postingTime: ReelPostingTime;
  firstComment: string;    // pre-written first comment to seed engagement
  burnableCaptionHints?: string;
}

export interface ReelMultiplierInput {
  sourceDurationSec: number;
  description?: string;    // optional 1-2 sentence creator description
  series?: string;
}

export interface ReelMultiplierOutput {
  source: { durationSec: number; description?: string };
  packages: ReelPackage[];     // exactly 3
  globalNotes?: string;
  musicLicensingNote: string;  // overarching guidance
}

