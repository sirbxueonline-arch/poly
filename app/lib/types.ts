export type RawEvent = {
  id?: string;
  slug?: string;
  ticker?: string;
  title?: string;
};

export type RawMarket = {
  id: string;
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  volume24hr?: number;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  events?: RawEvent[];
};

export type ParsedMarket = {
  id: string;
  question: string;
  slug: string;
  eventSlug: string | null;
  outcomes: string[];
  prices: number[];
  volume24hr: number;
  liquidity: number;
  endDate: string | null;
};

export type ScoredMarket = ParsedMarket & {
  momentum: number;
  score: number;
  prevPrice: number | null;
  reason: string;
  calloutSide: string | null;
};
