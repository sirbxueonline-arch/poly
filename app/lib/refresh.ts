import "server-only";

import {
  getMeta,
  getMetaNumber,
  isConfigured as isDbConfigured,
  pruneStalePredictions,
  setMeta,
  upsertPredictions,
} from "./db";
import { runDigest, type DigestMarket } from "./openai-digest";
import { buildPriceMap, scoreMarkets } from "./score";
import type { RawMarket } from "./types";

const POLYMARKET_URL =
  "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false";

/** How fresh the cache must be before we'll trigger a new refresh. */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Top N markets sent to the AI per refresh. */
const TOP_N = 50;

/** Markets per parallel OpenAI worker (50 markets / 5 = 10 workers). */
const AI_CHUNK_SIZE = 5;

/* ─────────────────────────────────────────────────────────────────────────
 * In-process state
 *
 * The refresh job is fire-and-forget from API routes (stale-while-revalidate).
 * `refreshInFlight` ensures only one refresh runs at a time even under request
 * bursts. The cached `lastDigestAtCache` lets `maybeKickOffRefresh()` decide
 * synchronously without an extra round trip per request.
 * ─────────────────────────────────────────────────────────────────────── */

let refreshInFlight = false;
let activeWorkers = 0;
let lastDigestAtCache = 0;

export type RefreshState = {
  refreshing: boolean;
  activeWorkers: number;
  lastDigestAt: number;
  nextDigestAt: number;
  pulseTake: string | null;
};

export async function getRefreshState(): Promise<RefreshState> {
  const lastFromDb = await getMetaNumber("last_digest_at");
  if (lastFromDb > 0) lastDigestAtCache = lastFromDb;
  return {
    refreshing: refreshInFlight,
    activeWorkers,
    lastDigestAt: lastDigestAtCache,
    nextDigestAt: lastDigestAtCache + REFRESH_INTERVAL_MS,
    pulseTake: await getMeta("pulse_take"),
  };
}

/**
 * Trigger a refresh if the cache is stale and no refresh is running.
 * Synchronous gate — the cached `lastDigestAtCache` is consulted first so we
 * don't have to await a DB read to make the decision. The actual refresh job
 * runs in the background; this function never throws.
 */
export function maybeKickOffRefresh(): boolean {
  if (refreshInFlight) return false;
  if (!isDbConfigured()) return false;
  if (Date.now() - lastDigestAtCache < REFRESH_INTERVAL_MS) return false;

  refreshInFlight = true;
  void runRefresh()
    .catch((err) => {
      console.error("[refresh] failed:", err);
    })
    .finally(() => {
      refreshInFlight = false;
      activeWorkers = 0;
    });
  return true;
}

/**
 * Force a refresh regardless of cache age. Awaitable.
 * No-op if a refresh is already running.
 */
export function forceRefresh(): Promise<void> {
  if (refreshInFlight) return Promise.resolve();
  refreshInFlight = true;
  return runRefresh()
    .catch((err) => {
      console.error("[refresh] forced failed:", err);
    })
    .finally(() => {
      refreshInFlight = false;
      activeWorkers = 0;
    });
}

/* ─────────────────────────────────────────────────────────────────────────
 * The actual refresh job
 * ─────────────────────────────────────────────────────────────────────── */

async function runRefresh(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[refresh] OPENAI_API_KEY missing — skipping AI work");
    return;
  }
  if (!isDbConfigured()) {
    console.warn("[refresh] Supabase not configured — skipping refresh");
    return;
  }

  console.log("[refresh] starting");
  const t0 = Date.now();

  // 1. Pull Polymarket
  const raws = await fetchPolymarketMarkets();
  if (raws.length === 0) {
    console.warn("[refresh] no markets returned from Polymarket");
    return;
  }

  // 2. Score against previously stored prices (momentum stays meaningful
  //    across the 5-minute window because we persist the last price map).
  const priorPrices = await loadPriorPriceMap();
  const scored = scoreMarkets(raws, priorPrices);
  if (scored.length === 0) {
    console.warn("[refresh] no scoreable markets after filtering");
    return;
  }

  const top = scored.slice(0, TOP_N);
  const rawById = new Map(raws.map((m) => [String(m.id), m]));

  // 3. Persist the new price map for next refresh's momentum calc
  const priceMap = buildPriceMap(raws);
  await savePriceMap(priceMap);

  // 4. Chunk and fan out parallel OpenAI workers
  const batches: (typeof top)[] = [];
  for (let i = 0; i < top.length; i += AI_CHUNK_SIZE) {
    batches.push(top.slice(i, i + AI_CHUNK_SIZE));
  }
  activeWorkers = batches.length;

  const aggregateMarkets: Array<{
    id: string;
    pick: string;
    fairValue: number;
    confidence: string;
    thesis: string;
    reason: string;
    category: string;
  }> = [];
  let pulseTakeOut = "";

  await Promise.allSettled(
    batches.map(async (batch, idx) => {
      try {
        const digestMarkets: DigestMarket[] = batch.map((m) => ({
          id: m.id,
          question: m.question,
          outcomes: m.outcomes,
          prices: m.prices,
          momentum: m.momentum,
          volume24hr: m.volume24hr,
        }));

        const result = await runDigest(digestMarkets, {
          apiKey,
          includePulseTake: idx === 0,
        });

        if (!result.ok) {
          console.warn(
            `[refresh] worker ${idx} failed: ${result.error}`,
            result.detail ?? "",
          );
          return;
        }

        if (idx === 0 && result.digest.pulseTake) {
          pulseTakeOut = result.digest.pulseTake;
        }
        for (const m of result.digest.markets) aggregateMarkets.push(m);
      } finally {
        activeWorkers = Math.max(0, activeWorkers - 1);
      }
    }),
  );

  // 5. Join AI output with scored market metadata and upsert in one round trip.
  const scoredById = new Map(top.map((m) => [m.id, m]));
  const rows = aggregateMarkets.flatMap((aiRow) => {
    const market = scoredById.get(aiRow.id);
    const rawMarket = rawById.get(aiRow.id);
    if (!market) return [];
    return [
      {
        id: market.id,
        question: market.question,
        slug: market.slug,
        eventSlug: market.eventSlug,
        outcomes: market.outcomes,
        yesPrice: market.prices[0] ?? 0,
        noPrice: market.prices[1] ?? 0,
        volume24hr: market.volume24hr,
        endDate: rawMarket?.endDate ?? market.endDate ?? null,
        pick: aiRow.pick,
        fairValue: aiRow.fairValue,
        confidence: aiRow.confidence,
        thesis: aiRow.thesis ?? null,
        reason: aiRow.reason ?? null,
        category: aiRow.category ?? null,
      },
    ];
  });

  await upsertPredictions(rows);

  // 6. Meta — written in parallel to save a couple round trips
  const now = Date.now();
  lastDigestAtCache = now;
  await Promise.all([
    pulseTakeOut ? setMeta("pulse_take", pulseTakeOut) : Promise.resolve(),
    setMeta("last_digest_at", String(now)),
    setMeta("last_market_count", String(top.length)),
  ]);

  // 7. GC any rows we haven't touched in a day
  await pruneStalePredictions();

  console.log(
    `[refresh] complete — ${rows.length} predictions in ${(Date.now() - t0) / 1000}s`,
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Polymarket fetcher
 * ─────────────────────────────────────────────────────────────────────── */

async function fetchPolymarketMarkets(): Promise<RawMarket[]> {
  try {
    const res = await fetch(POLYMARKET_URL, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "polymarket-pulse/2.0",
      },
    });
    if (!res.ok) {
      console.warn(`[refresh] polymarket returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as RawMarket[];
    if (!Array.isArray(data)) return [];
    return data;
  } catch (err) {
    console.warn("[refresh] polymarket fetch failed:", err);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Price-map persistence (for momentum tracking across refreshes)
 * ─────────────────────────────────────────────────────────────────────── */

async function loadPriorPriceMap(): Promise<Map<string, number[]>> {
  const raw = await getMeta("last_price_map");
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, number[]>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

async function savePriceMap(map: Map<string, number[]>): Promise<void> {
  const obj: Record<string, number[]> = {};
  for (const [k, v] of map.entries()) obj[k] = v;
  await setMeta("last_price_map", JSON.stringify(obj));
}
