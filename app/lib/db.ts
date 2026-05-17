import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type AIPrediction,
  type Category,
  isCategory,
  isConfidence,
  isPick,
} from "./ai";

/* ─────────────────────────────────────────────────────────────────────────
 * Supabase client
 *
 * Reads use the anon key when available, writes use the service-role key
 * (which bypasses RLS). The server holds both; the browser never imports
 * this file (the "server-only" guard at the top makes that a build error).
 * ─────────────────────────────────────────────────────────────────────── */

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  // Prefer service role on the server so writes work. Fall back to anon for
  // read-only setups, with a warning at first use.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[db] SUPABASE_SERVICE_ROLE_KEY missing — falling back to anon key (writes will fail).",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Returns true if Supabase env vars are present. Used by routes to surface
 * a clear "not configured" message instead of throwing on every request. */
export function isConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
  );
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

type Row = {
  id: string;
  question: string;
  slug: string;
  event_slug: string | null;
  outcomes: unknown; // jsonb
  yes_price: number;
  no_price: number;
  volume24hr: number;
  end_date: string | null;
  pick: string;
  fair_value: number;
  confidence: string;
  thesis: string | null;
  reason: string | null;
  category: string | null;
  updated_at: string; // ISO from Postgres timestamptz
};

function rowToMarket(r: Row): StoredMarket | null {
  if (!isPick(r.pick) || !isConfidence(r.confidence)) return null;
  const outcomes = Array.isArray(r.outcomes) ? r.outcomes.map(String) : [];
  if (outcomes.length < 2) return null;
  const updatedAt = Date.parse(r.updated_at);
  return {
    id: r.id,
    question: r.question,
    slug: r.slug,
    eventSlug: r.event_slug,
    outcomes,
    yesPrice: r.yes_price,
    noPrice: r.no_price,
    volume24hr: r.volume24hr,
    endDate: r.end_date,
    prediction: {
      pick: r.pick,
      fairValue: r.fair_value,
      confidence: r.confidence,
      thesis: r.thesis ?? "",
    },
    reason: r.reason,
    category: r.category && isCategory(r.category) ? r.category : null,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export async function readAllPredictions(): Promise<StoredMarket[]> {
  if (!isConfigured()) return [];
  const { data, error } = await client()
    .from("predictions")
    .select(
      "id, question, slug, event_slug, outcomes, yes_price, no_price, volume24hr, end_date, pick, fair_value, confidence, thesis, reason, category, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[db] readAllPredictions failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as Row[];
  const out: StoredMarket[] = [];
  for (const r of rows) {
    const m = rowToMarket(r);
    if (m) out.push(m);
  }
  return out;
}

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

export async function upsertPredictions(rows: UpsertInput[]): Promise<void> {
  if (rows.length === 0) return;
  if (!isConfigured()) return;
  const now = new Date().toISOString();
  const records = rows.map((r) => ({
    id: r.id,
    question: r.question,
    slug: r.slug,
    event_slug: r.eventSlug,
    outcomes: r.outcomes, // jsonb
    yes_price: r.yesPrice,
    no_price: r.noPrice,
    volume24hr: r.volume24hr,
    end_date: r.endDate,
    pick: r.pick,
    fair_value: r.fairValue,
    confidence: r.confidence,
    thesis: r.thesis,
    reason: r.reason,
    category: r.category,
    updated_at: now,
  }));
  const { error } = await client()
    .from("predictions")
    .upsert(records, { onConflict: "id" });
  if (error) {
    console.warn("[db] upsertPredictions failed:", error.message);
  }
}

/** Drop any prediction rows older than `cutoffMs` (default: 24h). */
export async function pruneStalePredictions(
  cutoffMs = 24 * 60 * 60 * 1000,
): Promise<void> {
  if (!isConfigured()) return;
  const cutoffIso = new Date(Date.now() - cutoffMs).toISOString();
  const { error } = await client()
    .from("predictions")
    .delete()
    .lt("updated_at", cutoffIso);
  if (error) {
    console.warn("[db] pruneStalePredictions failed:", error.message);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Meta key/value (pulse take, last digest timestamp, etc.)
 * ─────────────────────────────────────────────────────────────────────── */

export async function getMeta(key: string): Promise<string | null> {
  if (!isConfigured()) return null;
  const { data, error } = await client()
    .from("meta")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`[db] getMeta(${key}) failed:`, error.message);
    return null;
  }
  return (data?.value as string | undefined) ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  if (!isConfigured()) return;
  const { error } = await client()
    .from("meta")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) {
    console.warn(`[db] setMeta(${key}) failed:`, error.message);
  }
}

export async function getMetaNumber(key: string): Promise<number> {
  const v = await getMeta(key);
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
