import type { ParsedMarket, RawMarket, ScoredMarket } from "./types";

const MIN_VOLUME = 5000;
const MOMENTUM_FLOOR = 0.005;
const HIGH_VOLUME_THRESHOLD = 50000;

function safeParseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export function parseMarket(raw: RawMarket): ParsedMarket | null {
  if (!raw || !raw.id || !raw.question || !raw.slug) return null;

  // Drop finished markets — endDate in the past means the event has resolved
  // or is about to. Excluded BEFORE scoring so they never appear in the top 20.
  if (raw.endDate) {
    const end = new Date(raw.endDate).getTime();
    if (Number.isFinite(end) && end <= Date.now()) return null;
  }

  const outcomes = safeParseStringArray(raw.outcomes);
  const prices = safeParseNumberArray(raw.outcomePrices);
  if (outcomes.length < 2 || prices.length < 2) return null;

  // Drop near-resolved markets — one side at >= 99¢ means it's effectively
  // settled in trading and nothing left to predict, even if endDate is in
  // the future. Catches the "100¢ / 0¢" IPL-style stragglers.
  const maxSide = Math.max(prices[0] ?? 0, prices[1] ?? 0);
  if (maxSide >= 0.99) return null;

  const volume24hr =
    typeof raw.volume24hr === "number"
      ? raw.volume24hr
      : typeof raw.volume === "number"
        ? raw.volume
        : 0;

  const eventSlug =
    Array.isArray(raw.events) && raw.events.length > 0
      ? (raw.events[0]?.slug ?? raw.events[0]?.ticker ?? null)
      : null;

  return {
    id: String(raw.id),
    question: raw.question,
    slug: raw.slug,
    eventSlug,
    outcomes,
    prices,
    volume24hr,
    liquidity: typeof raw.liquidity === "number" ? raw.liquidity : 0,
    endDate: raw.endDate ?? null,
  };
}

function buildReason(
  market: ParsedMarket,
  momentum: number,
): { reason: string; calloutSide: string | null } {
  const absCents = Math.abs(momentum) * 100;
  const side = momentum >= 0 ? market.outcomes[0] : market.outcomes[1];
  const heavyVolume = market.volume24hr >= HIGH_VOLUME_THRESHOLD;
  const thinPrice = Math.abs(market.prices[0] - 0.5) < 0.1;

  if (Math.abs(momentum) >= MOMENTUM_FLOOR) {
    const direction = momentum >= 0 ? "toward" : "away from";
    const tail = heavyVolume
      ? " · heavy volume"
      : thinPrice
        ? " · coin-flip pricing"
        : "";
    return {
      reason: `${absCents.toFixed(1)}¢ shift ${direction} ${market.outcomes[0]}${tail}`,
      calloutSide: side,
    };
  }

  if (heavyVolume) {
    return {
      reason: `Heavy 24h volume · price stable at ${(market.prices[0] * 100).toFixed(0)}¢`,
      calloutSide: null,
    };
  }

  return {
    reason: `Active market · ${(market.prices[0] * 100).toFixed(0)}¢ on ${market.outcomes[0]}`,
    calloutSide: null,
  };
}

export function scoreMarkets(
  raws: RawMarket[],
  previous: Map<string, number[]>,
): ScoredMarket[] {
  const scored: ScoredMarket[] = [];

  for (const raw of raws) {
    const market = parseMarket(raw);
    if (!market) continue;
    if (market.volume24hr < MIN_VOLUME) continue;

    const prev = previous.get(market.id);
    const prevPrice = prev && prev.length > 0 ? prev[0] : null;
    const momentum = prevPrice !== null ? market.prices[0] - prevPrice : 0;

    const score =
      Math.abs(momentum) * 20 +
      Math.log10(market.volume24hr + 1) / 12 +
      Math.min(market.liquidity / 50000, 1) * 0.3 +
      (1 - Math.abs(market.prices[0] - 0.5) * 2) * 0.2;

    const { reason, calloutSide } = buildReason(market, momentum);

    scored.push({
      ...market,
      momentum,
      score,
      prevPrice,
      reason,
      calloutSide,
    });
  }

  const filtered = scored.filter(
    (m) =>
      Math.abs(m.momentum) >= MOMENTUM_FLOOR ||
      m.volume24hr >= HIGH_VOLUME_THRESHOLD,
  );

  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, 50);
}

export function buildPriceMap(raws: RawMarket[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const raw of raws) {
    const market = parseMarket(raw);
    if (!market) continue;
    map.set(market.id, market.prices);
  }
  return map;
}
