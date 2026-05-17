"use client";

import { motion } from "framer-motion";
import type { AIPrediction } from "@/app/lib/ai";
import type { ScoredMarket } from "@/app/lib/types";

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

type Props = {
  market: ScoredMarket;
  rank: number;
  prediction?: AIPrediction;
};

export function CompactRow({ market, rank, prediction }: Props) {
  const hours = hoursLeft(market.endDate);
  const color = prediction ? PICK_COLORS[prediction.pick] : "#71717a";
  const isPass = !prediction || prediction.pick === "Pass";
  const yesPrice = market.prices[0];

  const edgeCents = prediction && !isPass
    ? Math.round(
        (prediction.pick === "Yes"
          ? prediction.fairValue - yesPrice
          : yesPrice - prediction.fairValue) * 100,
      )
    : null;
  const edgeStr =
    edgeCents !== null
      ? `${prediction!.pick === "Yes" ? "+" : "−"}${Math.abs(edgeCents)}¢`
      : null;

  const pickLabel = !prediction
    ? "—"
    : prediction.pick === "Pass"
      ? "PASS"
      : (() => {
          const idx = prediction.pick === "Yes" ? 0 : 1;
          const raw = (market.outcomes[idx] ?? prediction.pick).trim();
          // For literal Yes/No keep the design's compact "B·YES" treatment.
          // For team/option labels use the first word or truncated form.
          if (/^(yes|no)$/i.test(raw)) return `B·${raw.toUpperCase()}`;
          const compact =
            raw.length <= 9 ? raw : raw.split(/\s+/)[0];
          return `B·${compact.toUpperCase()}`;
        })();

  return (
    <motion.div
      layout
      layoutId={`compact-${market.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ layout: { duration: 0.35 } }}
      className="relative flex items-center gap-2.5 overflow-hidden rounded-lg px-3.5 py-[9px]"
      style={{
        background: "white",
        border: "1px solid var(--border)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      {/* Left accent bar */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 top-0"
        style={{
          width: 3,
          borderRadius: "8px 0 0 8px",
          background: isPass ? `${PICK_COLORS.Pass}40` : color,
        }}
      />
      <span
        className="mono min-w-[22px] text-center text-[10px] font-bold"
        style={{ color: "var(--faint)" }}
      >
        #{rank}
      </span>
      <div
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {market.question}
      </div>
      <span
        className="mono whitespace-nowrap rounded px-2 py-[3px] text-[11px] font-extrabold tracking-[0.04em]"
        style={{ color, background: `${color}14` }}
      >
        {pickLabel}
      </span>
      {edgeStr && (
        <span
          className="mono min-w-[34px] text-right text-[11px] font-semibold"
          style={{ color }}
        >
          {edgeStr}
        </span>
      )}
      <span
        className="mono min-w-[28px] text-right text-[10px]"
        style={{ color: "var(--faint)" }}
        title={market.endDate ?? undefined}
      >
        {formatHours(hours)}
      </span>
      {/* Mini sparkline — design spec calls for 52×26 deterministic chart */}
      <MiniSpark
        yesPrice={yesPrice}
        color={isPass ? "#a8a29e" : color}
        seed={market.id}
      />
    </motion.div>
  );
}

function MiniSpark({
  yesPrice,
  color,
  seed,
}: {
  yesPrice: number;
  color: string;
  seed: string;
}) {
  const W = 52;
  const H = 26;
  const N = 8;
  // Deterministic series ending at yesPrice
  const hash = (() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h << 5) - h + seed.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  })();
  const points: number[] = [];
  let v = Math.max(0.05, Math.min(0.95, yesPrice + (((hash % 31) - 15) / 100)));
  for (let i = 0; i < N; i++) {
    if (i === N - 1) {
      v = yesPrice;
    } else {
      const noise = (((hash + i * 17) % 19) - 9) / 200;
      v = Math.max(0.02, Math.min(0.98, v + (yesPrice - v) * 0.22 + noise));
    }
    points.push(v);
  }
  const step = W / (N - 1);
  const top = H * 0.15;
  const bottom = H * 0.85;
  const span = bottom - top;
  const d = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (top + (1 - p) * span).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const fillD = `${d} L${W},${H} L0,${H} Z`;
  return (
    <div
      className="shrink-0 overflow-hidden rounded"
      style={{ width: W, height: H, background: "#f4f3f0" }}
      aria-hidden
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <path d={fillD} fill={`${color}18`} />
        <path d={d} fill="none" stroke={`${color}c0`} strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}
