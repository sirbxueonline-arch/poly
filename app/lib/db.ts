import "server-only";

import {
  type AIPrediction,
  type Category,
  isCategory,
  isConfidence,
  isPick,
} from "./ai";

/* ─────────────────────────────────────────────────────────────────────────
 * IN-MEMORY STORE
 *
 * Replaces the previous Supabase / SQLite backends. Predictions and meta
 * live for the lifetime of the Node process. The 5-minute refresh job
 * regenerates the cache, so persistence isn't strictly necessary — if the
 * dev server restarts, a fresh refresh fires on the first request.
 *
 * The exported API is intentionally sync now (no `await`s in callers).
 * ─────────────────────────────────────────────────────────────────────── */

export function isConfigured(): boolean {
  // The only required server-side env var is OPENAI_API_KEY. No database
  // to configure.
  return Boolean(process.env.OPENAI_API_KEY);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Predictions
 * ─────────────────────────────────────────────────────────────────────── */

export type StoredMarket = {
  id: string;
  question: string;
  slug: string;
  eventSlug: string | null;
  outcomes: string[];
  yesPrice: number;
  noPrice: number;
  volume24hr: number;
  endDate: string | null;
  prediction: AIPrediction;
  reason: string | null;
  category: Category | null;
  updatedAt: number;
};

export type UpsertInput = {
  id: string;
  question: string;
  slug: string;
  eventSlug: string | null;
  outcomes: string[];
  yesPrice: number;
  noPrice: number;
  volume24hr: number;
  endDate: string | null;
  pick: string;
  fairValue: number;
  confidence: string;
  thesis: string | null;
  reason: string | null;
  category: string | null;
};

const predictionStore: Map<string, StoredMarket> = new Map();
const metaStore: Map<string, string> = new Map();

function rowToMarket(r: UpsertInput, updatedAt: number): StoredMarket | null {
  if (!isPick(r.pick) || !isConfidence(r.confidence)) return null;
  if (!Array.isArray(r.outcomes) || r.outcomes.length < 2) return null;
  return {
    id: r.id,
    question: r.question,
    slug: r.slug,
    eventSlug: r.eventSlug,
    outcomes: r.outcomes.map(String),
    yesPrice: r.yesPrice,
    noPrice: r.noPrice,
    volume24hr: r.volume24hr,
    endDate: r.endDate,
    prediction: {
      pick: r.pick,
      fairValue: r.fairValue,
      confidence: r.confidence,
      thesis: r.thesis ?? "",
    },
    reason: r.reason,
    category: r.category && isCategory(r.category) ? r.category : null,
    updatedAt,
  };
}

export function readAllPredictions(): StoredMarket[] {
  // Most-recent first
  return [...predictionStore.values()].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function upsertPredictions(rows: UpsertInput[]): void {
  if (rows.length === 0) return;
  const now = Date.now();
  for (const r of rows) {
    const m = rowToMarket(r, now);
    if (m) predictionStore.set(m.id, m);
  }
}

/** Drop any prediction rows older than `cutoffMs` (default: 24h). */
export function pruneStalePredictions(
  cutoffMs = 24 * 60 * 60 * 1000,
): void {
  const cutoff = Date.now() - cutoffMs;
  for (const [id, m] of predictionStore.entries()) {
    if (m.updatedAt < cutoff) predictionStore.delete(id);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Meta key/value (pulse take, last digest timestamp, price-map JSON)
 * ─────────────────────────────────────────────────────────────────────── */

export function getMeta(key: string): string | null {
  return metaStore.get(key) ?? null;
}

export function setMeta(key: string, value: string): void {
  metaStore.set(key, value);
}

export function getMetaNumber(key: string): number {
  const v = getMeta(key);
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
