import type { AIPrediction, Category, Confidence } from "./ai";
import type { ScoredMarket } from "./types";

/**
 * Demo markets — taken straight from the Claude design package's
 * `dashboard.jsx`. Used as the page's initial state so the dashboard looks
 * fully populated on first paint, matching the design exactly.
 *
 * Replaced by real Polymarket data as soon as `/api/markets` returns.
 */

type Seed = {
  rank: number;
  id: string;
  question: string;
  cat: Category;
  pick: "Yes" | "No" | "Pass";
  cp: number;          // crowd / yes price
  fv: number;          // fair value
  conf: Confidence;
  mom: number;         // momentum in ¢/h
  vol: number;
  hours: number;
  score: number;
  topMover?: boolean;
  bestEdge?: boolean;
  isNew?: boolean;
  flipped?: boolean;
  reason: string;
  thesis: string;
};

const SEEDS: Seed[] = [
  {
    rank: 1, id: "demo-M001",
    question: "Will the Fed cut rates at the June 2026 FOMC meeting?",
    cat: "Economy", pick: "Yes", cp: 0.62, fv: 0.74, conf: "high",
    mom: 2.3, vol: 142000, hours: 18, score: 94, topMover: true, bestEdge: true,
    reason: "Post-CPI repricing underway; crowd serially conservative on this path.",
    thesis:
      "Bond market repricing suggests Fed optionality is wider than currently priced. CME futures at 62% fail to account for recent labor softness — this number should be moving. Catalyst: Powell testimony Thursday could trigger a cascade toward fair value.",
  },
  {
    rank: 2, id: "demo-M002",
    question: "Will the Fed announce an emergency rate hike before June?",
    cat: "Economy", pick: "No", cp: 0.38, fv: 0.20, conf: "high",
    mom: 5.6, vol: 210000, hours: 0.87, score: 96, bestEdge: true,
    reason: "Zero Fed messaging supports this; market is pricing tail risk, not base case.",
    thesis:
      "The FOMC has given no signals consistent with emergency action — this is fear pricing. Current pricing at 38% YES is 18¢ away from our fair value. Closes in under an hour. Urgency is real.",
  },
  {
    rank: 3, id: "demo-M003",
    question: "Will BTC exceed $120K before July 1, 2026?",
    cat: "Crypto", pick: "No", cp: 0.58, fv: 0.44, conf: "medium",
    mom: 1.8, vol: 98000, hours: 6, score: 87, flipped: true,
    reason: "On-chain data contradicts the narrative; retail FOMO not backed by spot flow.",
    thesis:
      "Spot BTC ETF outflows for 3 consecutive days paint a different picture than price action. Crowd at 58% YES is pricing euphoria — not a breakout level by any structural metric. Short-dated options skew is negative; market makers are hedging the other way.",
  },
  {
    rank: 4, id: "demo-M004",
    question: "Will Nvidia close above $200 on May 20?",
    cat: "Tech", pick: "Yes", cp: 0.47, fv: 0.59, conf: "medium",
    mom: 3.1, vol: 67000, hours: 48, score: 78,
    reason: "Options flow and gamma positioning both favour the upside this week.",
    thesis:
      "Dealer gamma positioning has flipped net-long above $195 — this is a magnetic level. AI capex announcements still pricing in; the narrative has legs through this week. Crowd at 47% is structurally behind — fair value closer to 59%.",
  },
  {
    rank: 5, id: "demo-M005",
    question: "Will Tesla report positive Q2 guidance in today's call?",
    cat: "Tech", pick: "Yes", cp: 0.44, fv: 0.59, conf: "medium",
    mom: 4.2, vol: 89000, hours: 0.75, score: 88, flipped: true,
    reason: "Call starts in 45 minutes; whisper numbers are above consensus.",
    thesis:
      "Q1 delivery data surprised to the upside — management historically guides conservatively post-beat. Options market is pricing a +8% move; fair value on this outcome is closer to 59%. Closes in 45 minutes. Act before the guidance is read.",
  },
  {
    rank: 6, id: "demo-M006",
    question: "Will S&P 500 close above 5,800 this week?",
    cat: "Economy", pick: "Yes", cp: 0.51, fv: 0.60, conf: "low",
    mom: 1.4, vol: 45000, hours: 72, score: 71, isNew: true,
    reason: "Put-call ratio at a 3-month low; systematic buyers are not hedged.",
    thesis:
      "Put-call ratio is at a 3-month low — systematic buyers are not hedged against a move higher. The 5,800 level is within reach given current momentum and no scheduled risk events. New call: first digest this week with updated post-CPI macro data.",
  },
  {
    rank: 7, id: "demo-M007",
    question: "Will Apple announce new iPhone before WWDC 2026?",
    cat: "Tech", pick: "No", cp: 0.42, fv: 0.31, conf: "medium",
    mom: 2.1, vol: 38000, hours: 72, score: 75,
    reason: "Apple product cycle cadence makes pre-WWDC hardware announcement extremely unlikely.",
    thesis:
      "No supply chain leaks or regulatory filings consistent with a pre-WWDC launch. Apple has not broken its fall iPhone cycle in 6 years. Crowd at 42% is mispriced. Edge of 11¢ against a consensus that has no anchor to Apple's actual behaviour.",
  },
  {
    rank: 8, id: "demo-M008",
    question: "Will gold hit a new all-time high this week?",
    cat: "Economy", pick: "No", cp: 0.35, fv: 0.26, conf: "medium",
    mom: 1.2, vol: 29000, hours: 96, score: 68,
    reason: "Dollar strength and reduced geopolitical premium weigh against near-term ATH.",
    thesis:
      "DXY has recovered 0.8% this week, creating a headwind for gold in dollar terms. Current price is 2.3% below ATH — a gap rarely closed in a single week without a catalyst. No scheduled event that would generate the 2.3% move required.",
  },
  {
    rank: 9, id: "demo-M009",
    question: "Will Meta Q1 earnings beat analyst estimates?",
    cat: "Tech", pick: "No", cp: 0.44, fv: 0.35, conf: "medium",
    mom: 0.7, vol: 31000, hours: 48, score: 66,
    reason: "Ad market softness and Reality Labs losses likely to weigh on topline.",
    thesis:
      "Digital ad spending showed MoM deceleration in March per third-party data. Consensus EPS estimate crept up 8% in the last 30 days — now looks stretched. Reality Labs losses likely wider than guided; this alone could tip the miss.",
  },
  {
    rank: 10, id: "demo-M010",
    question: "Will Elon Musk post about crypto today?",
    cat: "Crypto", pick: "Yes", cp: 0.61, fv: 0.70, conf: "medium",
    mom: 1.6, vol: 52000, hours: 3, score: 73,
    reason: "Recent activity pattern shows elevated crypto posting frequency this week.",
    thesis:
      "Musk has posted about crypto or Dogecoin on 4 of the last 7 days. A scheduled podcast appearance at 2pm is likely to include crypto discussion. Crowd at 61% is below base-rate given recent patterns — 9¢ of edge.",
  },
  {
    rank: 11, id: "demo-M011",
    question: "Will Senate pass immigration bill before summer recess?",
    cat: "Politics", pick: "Pass", cp: 0.31, fv: 0.31, conf: "low",
    mom: 0.4, vol: 34000, hours: 72, score: 61, isNew: true,
    reason: "No edge signal. Crowd is fairly calibrated; monitor for committee vote.",
    thesis:
      "Both sides of this market look right — there's no information edge here. Volume is thin and liquidity shallow; this is not a good place to take a position. Monitor for breaking news but don't trade the current signal.",
  },
  {
    rank: 12, id: "demo-M012",
    question: "Will Donald Trump tweet 5+ times today?",
    cat: "Politics", pick: "Pass", cp: 0.72, fv: 0.73, conf: "low",
    mom: 0.3, vol: 21000, hours: 12, score: 55,
    reason: "Within margin of model error. Historical average aligns with crowd at 72%.",
    thesis:
      "Historical average is 6.2 tweets/day — crowd at 72% is reasonably calibrated. No scheduled events that typically spike tweet volume. Edge of 1¢ is within noise threshold. Pass.",
  },
  {
    rank: 13, id: "demo-M013",
    question: "Will NBA Finals go to Game 7?",
    cat: "Sports", pick: "Pass", cp: 0.28, fv: 0.29, conf: "low",
    mom: 0.2, vol: 18000, hours: 120, score: 52,
    reason: "Negligible edge. Series odds are well-calibrated by the market.",
    thesis:
      "Historical Game 7 frequency for series at this stage is 27-29% — crowd is spot on. No injury news or matchup anomalies that would shift the distribution. Pass.",
  },
  {
    rank: 14, id: "demo-M014",
    question: "Will Ukraine ceasefire talks resume before June?",
    cat: "World Events", pick: "Yes", cp: 0.54, fv: 0.63, conf: "low",
    mom: 0.9, vol: 41000, hours: 120, score: 69,
    reason: "Diplomatic back-channels show renewed activity; three EU mediators active.",
    thesis:
      "Classified briefings to European capitals have resumed per credible sources. Crowd at 54% is discounting the diplomatic signal — fair value closer to 63%. Not a high-conviction call but the directional signal is clear.",
  },
  {
    rank: 15, id: "demo-M015",
    question: "Will Dogecoin exceed $0.20 before June 1?",
    cat: "Crypto", pick: "Pass", cp: 0.45, fv: 0.46, conf: "low",
    mom: 0.5, vol: 24000, hours: 240, score: 54,
    reason: "Effectively a coin flip at current prices. No informational edge.",
    thesis:
      "Current DOGE at $0.184 — a 9% move needed. Plausible but no catalyst identified. Crowd at 45% is essentially fair value given the volatility profile. No position.",
  },
];

/**
 * Build a synthetic endDate string `hours` from now (so the time-left chip
 * matches the design's spec for each row).
 */
function endDateFromHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export const DEMO_MARKETS: ScoredMarket[] = SEEDS.map((s) => ({
  id: s.id,
  question: s.question,
  slug: s.id.toLowerCase(),
  eventSlug: null,
  outcomes: ["Yes", "No"],
  prices: [s.cp, 1 - s.cp],
  volume24hr: s.vol,
  liquidity: s.vol * 0.4,
  endDate: endDateFromHours(s.hours),
  momentum: s.mom / 100,
  score: s.score / 100,
  prevPrice: s.cp - s.mom / 100,
  reason: s.reason,
  calloutSide: null,
}));

export const DEMO_PREDICTIONS: Record<string, AIPrediction> =
  Object.fromEntries(
    SEEDS.map((s) => [
      s.id,
      {
        pick: s.pick,
        fairValue: s.fv,
        confidence: s.conf,
        thesis: s.thesis,
      },
    ]),
  );

export const DEMO_REASONS: Record<string, string> = Object.fromEntries(
  SEEDS.map((s) => [s.id, s.reason]),
);

export const DEMO_CATEGORIES: Record<string, Category> = Object.fromEntries(
  SEEDS.map((s) => [s.id, s.cat]),
);

export const DEMO_PULSE_TAKE =
  "The Fed's June window is more open than the crowd thinks — CME futures are sleeping on the labor data, and the 12¢ edge in the rate-cut market is the clearest mispricing on the board right now.";
