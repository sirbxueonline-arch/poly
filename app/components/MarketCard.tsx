"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { AIPrediction, Category } from "@/app/lib/ai";
import type { ScoredMarket } from "@/app/lib/types";
import { PolymarketEmbed } from "./PolymarketEmbed";
import { Verdict } from "./Verdict";

const PICK_COLORS = {
  Yes: "#047857",
  No: "#b91c1c",
  Pass: "#71717a",
} as const;

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

function hoursLeft(endDate: string | null): number {
  if (!endDate) return Infinity;
  const ms = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

function volumeStr(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1_000).toFixed(0)}K`;
}

type Props = {
  market: ScoredMarket;
  rank: number;
  aiReason?: string;
  category?: Category;
  prediction?: AIPrediction;
  isBestEdge?: boolean;
  isTopMover?: boolean;
  pickChange?: "new" | "flipped";
  aiLoading?: boolean;
  aiConfigured?: boolean;
};

export function MarketCard({
  market,
  rank,
  aiReason,
  category,
  prediction,
  isBestEdge = false,
  isTopMover = false,
  pickChange,
  aiLoading = false,
  aiConfigured = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState<{
    loading: boolean;
    text: string | null;
    error: string | null;
  }>({ loading: false, text: null, error: null });

  const hours = hoursLeft(market.endDate);
  const urgent = hours <= 1;
  const color = prediction ? PICK_COLORS[prediction.pick] : "#71717a";
  const polymarketUrl = market.eventSlug
    ? `https://polymarket.com/event/${market.eventSlug}`
    : `https://polymarket.com/markets?q=${encodeURIComponent(market.question)}`;

  const momentumPctPerHr = market.momentum * 100; // momentum is a per-tick fraction; we treat as ¢/h for display
  const reasonText = aiReason?.trim() || market.reason;

  async function handleExplain() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (explain.text || explain.loading) return;
    if (prediction?.thesis) {
      // We already have the thesis — show it without an extra call
      return;
    }
    setExplain({ loading: true, text: null, error: null });
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: market.id,
          question: market.question,
          outcomes: market.outcomes,
          prices: market.prices,
          momentum: market.momentum,
          volume24hr: market.volume24hr,
          liquidity: market.liquidity,
          endDate: market.endDate,
        }),
      });
      const data = (await res.json()) as
        | { explanation: string }
        | { error: string };
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : `API ${res.status}`;
        setExplain({ loading: false, text: null, error: msg });
        return;
      }
      setExplain({ loading: false, text: data.explanation, error: null });
    } catch (err) {
      setExplain({
        loading: false,
        text: null,
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <motion.article
      layout
      layoutId={market.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.25 },
      }}
      className={`market-card relative overflow-hidden ${
        pickChange ? "verdict-fresh" : ""
      }`}
      style={
        urgent
          ? {
              borderColor: color,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px ${color}30, 0 4px 20px ${color}15, 0 16px 40px rgba(0,0,0,0.06)`,
            }
          : undefined
      }
    >
      {/* Pick accent line on top */}
      {prediction && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0"
          style={{
            height: 3,
            borderRadius: "16px 16px 0 0",
            background:
              prediction.pick === "Pass"
                ? `linear-gradient(90deg, ${PICK_COLORS.Pass}50, transparent)`
                : `linear-gradient(90deg, ${color}, ${color}60, transparent)`,
          }}
        />
      )}

      <div className="px-[18px] pb-[18px] pt-4">
        {/* Meta row */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className="mono rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em]"
            style={{
              color: isTopMover ? "var(--amber)" : "var(--faint)",
              background: "#f3f1ed",
            }}
          >
            {isTopMover ? `★ #${rank}` : `#${rank}`}
          </span>
          {category && (
            <span
              className="mono text-[10px] tracking-[0.1em]"
              style={{ color: "var(--faint)" }}
            >
              {category.toUpperCase()}
            </span>
          )}
          {pickChange === "new" && (
            <span
              className="mono rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em]"
              style={{ color: "#6366f1", background: "#eef2ff" }}
            >
              NEW
            </span>
          )}
          {pickChange === "flipped" && (
            <span
              className="mono rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em]"
              style={{ color: "var(--amber)", background: "var(--amber-bg)" }}
            >
              FLIPPED
            </span>
          )}
          {isBestEdge && prediction && (
            <span
              className="mono rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em]"
              style={{ color, background: `${color}18` }}
            >
              BEST EDGE
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {urgent && (
              <div
                aria-hidden
                className="h-1.5 w-1.5 rounded-full ppulse-rose"
                style={{ background: "var(--no)" }}
              />
            )}
            <span
              className="mono text-[10px]"
              style={{
                color: urgent ? "var(--no)" : "var(--faint)",
                fontWeight: urgent ? 700 : 400,
              }}
              title={market.endDate ?? undefined}
            >
              {formatHours(hours)}
            </span>
          </div>
        </div>

        {/* Question */}
        <div
          className="mb-3.5 text-[17px] font-semibold leading-[1.35]"
          style={{ color: "var(--text)", textWrap: "pretty" as never }}
        >
          {market.question}
        </div>

        {/* Verdict (or skeleton) */}
        {prediction ? (
          <Verdict
            prediction={prediction}
            marketYesPrice={market.prices[0]}
            outcomes={market.outcomes}
          />
        ) : aiConfigured ? (
          <VerdictSkeleton loading={aiLoading} />
        ) : null}

        {/* Polymarket chart — lightweight SVG sparkline (no iframe in
            regular cards; the live iframe is reserved for the Featured card). */}
        <div className="mt-3">
          <PolymarketEmbed
            eventSlug={market.eventSlug}
            marketSlug={market.slug}
            question={market.question}
            yesPrice={market.prices[0]}
            pick={prediction?.pick}
            featured={false}
          />
        </div>

        {/* Context strip */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span
            className="mono rounded px-[7px] py-[3px] text-[10px] font-semibold"
            style={{ color, background: `${color}12` }}
          >
            {momentumPctPerHr >= 0 ? "↑" : "↓"}
            {Math.abs(momentumPctPerHr).toFixed(1)}¢/h
          </span>
          <span
            className="mono text-[10px]"
            style={{ color: "var(--faint)" }}
          >
            {volumeStr(market.volume24hr)} 24h
          </span>
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] italic"
            style={{ color: "var(--muted)" }}
          >
            {reasonText}
          </span>
        </div>

        {/* Thesis (expandable) */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="thesis"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div
                className="mt-2.5 rounded-lg px-3.5 py-3"
                style={{
                  background: "#f8f7f4",
                  borderLeft: `3px solid ${color}40`,
                }}
              >
                {prediction?.thesis ? (
                  splitThesis(prediction.thesis).map((line, i) => (
                    <p
                      key={i}
                      className="text-[13px] leading-[1.65]"
                      style={{
                        color: "var(--muted)",
                        marginBottom: i < splitThesis(prediction.thesis).length - 1 ? 8 : 0,
                        fontStyle: i === 1 ? "italic" : "normal",
                      }}
                    >
                      {line}
                    </p>
                  ))
                ) : explain.loading ? (
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-11/12 rounded" />
                    <div className="skeleton h-3 w-4/5 rounded" />
                  </div>
                ) : explain.text ? (
                  <p
                    className="text-[13px] leading-[1.65]"
                    style={{ color: "var(--muted)" }}
                  >
                    {explain.text}
                  </p>
                ) : explain.error ? (
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--no)" }}
                  >
                    {explain.error.includes("not configured")
                      ? "Add OPENAI_API_KEY to .env.local to enable AI explanations."
                      : `Could not load: ${explain.error}`}
                  </p>
                ) : (
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--faint)" }}
                  >
                    No thesis yet — waiting for AI digest.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className="mt-3 flex gap-2 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={handleExplain}
            className="flex-1 cursor-pointer rounded-md px-2.5 py-[7px] text-[12px] font-medium transition-colors"
            style={{
              color: "var(--muted)",
              background: "none",
              border: "1px solid var(--border)",
            }}
          >
            {open ? "Collapse ↑" : "Why this? →"}
          </button>
          <a
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 cursor-pointer rounded-md px-2.5 py-[7px] text-center text-[12px] font-medium transition-colors"
            style={{
              color: "var(--muted)",
              background: "none",
              border: "1px solid var(--border)",
            }}
          >
            Open ↗
          </a>
        </div>
      </div>
    </motion.article>
  );
}

function splitThesis(thesis: string): string[] {
  if (!thesis) return [];
  // Split on sentence boundaries; cap at 3
  const parts = thesis.match(/[^.!?]+[.!?]+\s*/g);
  if (!parts) return [thesis];
  return parts.map((p) => p.trim()).slice(0, 3);
}

function VerdictSkeleton({ loading }: { loading: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-dashed"
      style={{
        background: "#fafaf9",
        borderColor: "var(--border)",
        borderTop: "3px solid #d6d3c9",
        padding: "13px 16px",
      }}
    >
      <div
        className="mono mb-1.5 text-[9px] tracking-[0.18em]"
        style={{ color: "var(--faint)" }}
      >
        AI RULING · {loading ? "THINKING…" : "AWAITING NEXT TICK"}
      </div>
      <div className={`${loading ? "skeleton" : "bg-zinc-100"} mb-1.5 h-7 w-32 rounded`} />
      <div className="mb-2 flex items-center gap-2">
        <div className="flex flex-1 gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`${loading ? "skeleton" : "bg-zinc-200/60"} h-1 flex-1 rounded`} />
          ))}
        </div>
      </div>
      <div className={`${loading ? "skeleton" : "bg-zinc-100"} h-1.5 w-full rounded-full`} />
    </div>
  );
}
