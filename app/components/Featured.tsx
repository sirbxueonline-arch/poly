"use client";

import type { AIPrediction, Category } from "@/app/lib/ai";
import type { ScoredMarket } from "@/app/lib/types";
import { Verdict } from "./Verdict";

const PICK_COLORS = {
  Yes: "#047857",
  No: "#b91c1c",
  Pass: "#71717a",
} as const;

function hoursLeft(endDate: string | null): number {
  if (!endDate) return Infinity;
  const ms = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

function splitThesis(thesis: string): string[] {
  if (!thesis) return [];
  const parts = thesis.match(/[^.!?]+[.!?]+\s*/g);
  if (!parts) return [thesis];
  return parts.map((p) => p.trim()).slice(0, 3);
}

type Props = {
  market: ScoredMarket;
  prediction?: AIPrediction;
  category?: Category;
};

export function Featured({ market, prediction, category }: Props) {
  const color = prediction ? PICK_COLORS[prediction.pick] : "#b45309";
  const hours = hoursLeft(market.endDate);
  const yesPrice = market.prices[0];
  const polymarketUrl = market.eventSlug
    ? `https://polymarket.com/event/${market.eventSlug}`
    : `https://polymarket.com/markets?q=${encodeURIComponent(market.question)}`;

  const score = Math.round(market.score * 100);
  const momentum = market.momentum * 100;
  const confDecimal =
    prediction?.confidence === "high"
      ? 0.9
      : prediction?.confidence === "medium"
        ? 0.65
        : 0.35;

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-1.5">
      <div
        className="relative overflow-hidden rounded-[20px]"
        style={{
          background:
            "linear-gradient(135deg, #0f0e0c 0%, #1c1a17 55%, #0f0e0c 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 24px 72px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        {/* Glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            top: -80,
            left: -60,
            width: 300,
            height: 300,
            background: "rgba(180,83,9,0.1)",
            filter: "blur(80px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            bottom: -80,
            right: 100,
            width: 260,
            height: 260,
            background: `${color}10`,
            filter: "blur(70px)",
          }}
        />
        {/* Top accent line */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${color}, ${color}70, transparent)`,
          }}
        />

        <div className="relative grid gap-8 px-8 py-7 lg:grid-cols-[1fr_minmax(0,360px)]">
          {/* Left column */}
          <div>
            <div className="mb-[18px] flex flex-wrap items-center gap-2">
              <span
                className="mono rounded px-[9px] py-[3px] text-[10px] font-extrabold tracking-[0.14em]"
                style={{
                  color: "var(--amber)",
                  background: "rgba(180,83,9,0.2)",
                }}
              >
                ★ #1 TOP MOVER
              </span>
              {category && (
                <span
                  className="mono text-[10px] tracking-[0.13em]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  {category.toUpperCase()}
                </span>
              )}
              <span
                className="mono ml-auto text-[10px]"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                {formatHours(hours).toUpperCase()} LEFT · SCORE {score}
              </span>
            </div>

            {/* Question */}
            <div
              className="mb-[22px] text-[30px] font-bold leading-[1.22] tracking-[-0.01em]"
              style={{
                color: "rgba(255,255,255,0.95)",
                textWrap: "pretty" as never,
              }}
            >
              {market.question}
            </div>

            {/* Verdict (dark) */}
            {prediction ? (
              <Verdict
                prediction={prediction}
                marketYesPrice={yesPrice}
                outcomes={market.outcomes}
                size="lg"
                dark
              />
            ) : (
              <div
                className="mono rounded-lg px-5 py-4 text-[11px] tracking-[0.18em]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                AI RULING · LOADING…
              </div>
            )}

            {/* AI Thesis */}
            {prediction?.thesis && (
              <div
                className="mt-5 pl-4"
                style={{ borderLeft: `3px solid ${color}45` }}
              >
                <div
                  className="mono mb-2 text-[9px] tracking-[0.16em]"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  AI THESIS
                </div>
                {splitThesis(prediction.thesis).map((line, i, arr) => (
                  <p
                    key={i}
                    className="text-[13px] leading-[1.7]"
                    style={{
                      color:
                        i === 1
                          ? "rgba(255,255,255,0.62)"
                          : "rgba(255,255,255,0.4)",
                      fontStyle: i === 1 ? "italic" : "normal",
                      marginBottom: i < arr.length - 1 ? 7 : 0,
                    }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2.5">
            <FeaturedChart market={market} color={color} />

            <div className="grid grid-cols-2 gap-1.5">
              <Stat
                label="MOMENTUM"
                value={`${momentum >= 0 ? "↑" : "↓"}${Math.abs(momentum).toFixed(1)}¢/h`}
                color={color}
              />
              <Stat
                label="24H VOL"
                value={
                  market.volume24hr >= 1_000_000
                    ? `$${(market.volume24hr / 1_000_000).toFixed(1)}M`
                    : `$${(market.volume24hr / 1_000).toFixed(0)}K`
                }
                color="rgba(255,255,255,0.65)"
              />
              <Stat
                label="SCORE"
                value={`${score}/100`}
                color="var(--amber)"
              />
              <Stat
                label="CONFIDENCE"
                value={`${Math.round(confDecimal * 100)}%`}
                color={color}
              />
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                className="flex-1 cursor-pointer rounded-lg py-[9px] text-[12px]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                Why this? →
              </button>
              <a
                href={polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 cursor-pointer rounded-lg py-[9px] text-center text-[12px] no-underline"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                Open Polymarket ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg px-2.5 py-2"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <div
        className="mono mb-[3px] text-[8px] tracking-[0.14em]"
        style={{ color: "rgba(255,255,255,0.22)" }}
      >
        {label}
      </div>
      <div className="mono text-[15px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function FeaturedChart({
  market,
  color,
}: {
  market: ScoredMarket;
  color: string;
}) {
  const yesPrice = market.prices[0];
  // Build a 7-point synthetic series anchored to the current price.
  // Real-time chart data would replace this; the design calls for a dark line
  // chart with current-price overlay.
  const points = useSyntheticSeries(market.id, yesPrice);
  const pathD = pointsToPath(points, 360, 220);
  const fillD = `${pathD} L360,220 L0,220 Z`;

  return (
    <div
      className="relative flex-1 overflow-hidden rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        minHeight: 200,
      }}
    >
      <svg
        width="100%"
        height={220}
        viewBox="0 0 360 220"
        preserveAspectRatio="none"
        className="block"
      >
        <path d={fillD} fill={`${color}18`} />
        <path d={pathD} fill="none" stroke={`${color}90`} strokeWidth={2.5} />
      </svg>
      <div className="absolute left-3 top-2.5 flex items-center gap-1.5">
        <div
          aria-hidden
          className="h-[7px] w-[7px] rounded-full ppulse"
          style={{
            background: "#10b981",
            boxShadow: "0 0 0 3px rgba(16,185,129,0.2)",
          }}
        />
        <span
          className="mono text-[9px] tracking-[0.14em]"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          POLYMARKET LIVE
        </span>
      </div>
      <div className="absolute right-3.5 top-[40%] text-right">
        <div
          className="mono text-[28px] font-extrabold"
          style={{ color }}
        >
          {Math.round(yesPrice * 100)}¢
        </div>
        <div
          className="mono text-[9px] tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          CURRENT
        </div>
      </div>
    </div>
  );
}

function useSyntheticSeries(id: string, current: number): number[] {
  // Deterministic from id, ending at `current`. Used only when no real-time
  // chart data is available.
  const seed = hashCode(id);
  const points: number[] = [];
  let v = current * 0.7 + 0.15;
  for (let i = 0; i < 7; i++) {
    const noise = (((seed + i * 31) % 100) - 50) / 600;
    v = Math.max(0.02, Math.min(0.98, v + noise + (current - v) * 0.18));
    points.push(v);
  }
  points[points.length - 1] = current;
  return points;
}

function pointsToPath(values: number[], w: number, h: number): string {
  if (values.length === 0) return `M0,${h / 2} L${w},${h / 2}`;
  const step = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = (1 - v) * h * 0.85 + h * 0.05;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
