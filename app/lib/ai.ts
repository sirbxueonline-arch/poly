export const CATEGORIES = [
  "Crypto",
  "Politics",
  "Sports",
  "Economy",
  "Tech",
  "Pop Culture",
  "World Events",
  "Science",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PICKS = ["Yes", "No", "Pass"] as const;
export type AIPick = (typeof PICKS)[number];

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export type AIDigestMarket = {
  id: string;
  reason: string;
  category: Category;
  pick: AIPick;
  fairValue: number;
  confidence: Confidence;
  thesis: string;
};

export type AIDigest = {
  pulseTake: string;
  markets: AIDigestMarket[];
};

/** Per-market AI prediction held in client state */
export type AIPrediction = {
  pick: AIPick;
  fairValue: number;
  confidence: Confidence;
  thesis: string;
};

export function isPick(v: unknown): v is AIPick {
  return typeof v === "string" && (PICKS as readonly string[]).includes(v);
}

export function isConfidence(v: unknown): v is Confidence {
  return (
    typeof v === "string" && (CONFIDENCES as readonly string[]).includes(v)
  );
}

export type AIExplanation = {
  id: string;
  explanation: string;
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
