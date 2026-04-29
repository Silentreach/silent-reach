/* New Day-14 types for the niche-aware Pre-Production. Old PreShootInput
   stays in types/index.ts for back-compat with the legacy /api/pre-shoot
   schema and the rest of the codebase that still reads it. */

export type Niche = "real_estate" | "construction" | "general";

export type Mood =
  | "cinematic"
  | "documentary"
  | "energetic"
  | "calm"
  | "luxury"
  | "editorial";

export type RealEstateListingStage =
  | "coming_soon"
  | "just_listed"
  | "open_house"
  | "price_improvement"
  | "sold";

export type RealEstateBuyerPersona =
  | "first_time"
  | "move_up_family"
  | "downsizer"
  | "investor"
  | "out_of_province"
  | "luxury";

export interface RealEstateInputs {
  niche: "real_estate";
  address: string;
  listingStage: RealEstateListingStage;
  openHouseDate?: string;            // ISO date, only for listing_stage = open_house
  buyerPersonas: RealEstateBuyerPersona[];   // 1-2 selected
  heroShot?: string;                 // "the ONE shot you must get"
  moods: Mood[];                     // 0-2 selected
  platform: "instagram" | "youtube" | "youtube_shorts" | "linkedin" | "all";
  videoLength: "15s" | "30s" | "45s" | "60s" | "90s";
  conceptOverride?: string;          // optional, empty = AI infers
  mlsText?: string;                  // optional paste
  manualPropertyFacts?: {
    beds?: number;
    baths?: number;
    sqft?: number;
    yearBuilt?: number;
    lotSqft?: number;
    askingPriceCad?: number;
  };
}

export type ConstructionPhase =
  | "demo"
  | "framing"
  | "rough_in"
  | "drywall"
  | "finish"
  | "final_reveal";

export type ConstructionArc =
  | "problem_solution"
  | "before_after"
  | "process_hero"
  | "time_lapse"
  | "trade_spotlight";

export type Trade =
  | "gc"
  | "carpenter"
  | "mason"
  | "electrician"
  | "plumber"
  | "tile_finish"
  | "landscape";

export interface ConstructionInputs {
  niche: "construction";
  projectPhase: ConstructionPhase;
  transformationArc: ConstructionArc;
  tradeFocus: Trade[];               // 0-2 selected
  audienceMode: "client_facing" | "trade_facing";
  heroShot?: string;
  moods: Mood[];
  platform: "instagram" | "youtube" | "youtube_shorts" | "linkedin" | "all";
  videoLength: "15s" | "30s" | "45s" | "60s" | "90s";
  address?: string;                  // optional for Construction
  droneAvailable: boolean;
  siteSafetyConstraints?: string;
  conceptOverride?: string;
}

export type GeneralContentMode =
  | "day_in_the_life"
  | "explainer"
  | "review"
  | "tutorial"
  | "vlog"
  | "hot_take";

export interface GeneralInputs {
  niche: "general";
  contentMode: GeneralContentMode;
  concept: string;                   // required for General
  heroShot?: string;
  moods: Mood[];
  platform: "instagram" | "youtube" | "youtube_shorts" | "linkedin" | "all";
  videoLength: "15s" | "30s" | "45s" | "60s" | "90s";
  audience?: string;
}

export type NicheInputs = RealEstateInputs | ConstructionInputs | GeneralInputs;

export interface CreativeDirection {
  id: string;                        // "d1" | "d2" | "d3"
  headline: string;                  // 4-word punchy title
  concept: string;                   // 1-line pitch
  hookStyle: "curiosity" | "contrarian" | "stakes" | "voyeur" | "transformation" | "withhold";
  moods: Mood[];
  structuralArc: string;             // free text, e.g. "tease", "reveal", "day-in-this-home"
}

export interface NearbyPlace {
  name: string;
  category: string;       // "school" | "park" | "transit" | "restaurant" | "landmark"
  distanceMeters: number;
  osmTags?: Record<string, string>;
}

export interface AddressEnrichment {
  formattedAddress: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  postalCode?: string;
  schools: NearbyPlace[];
  parks: NearbyPlace[];
  amenities: NearbyPlace[];
  landmarks: NearbyPlace[];
  walkScore?: { walk?: number; transit?: number; bike?: number };
}
