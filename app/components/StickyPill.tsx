"use client";

import type { AIPrediction } from "@/app/lib/ai";
import type { ScoredMarket } from "@/app/lib/types";

const PICK_COLORS = {
  Yes: "#047857",
  No: "#b91c1c",
  Pass: "#71717a",
} as const;

type Props = {
  market: ScoredMarket;
  prediction?: AIPrediction;
  rank: number;
  visible: boolean;
};

export function StickyPill({ market, prediction, rank, visible }: Props) {
  if (!prediction || prediction.pick === "Pass") return null;
  const color = PICK_COLORS[prediction.pick];
  const yesPrice = market.prices[0];
  const edge = Math.round(
    (prediction.pick === "Yes"
      ? prediction.fairValue - yesPrice
      : yesPrice - prediction.fairValue) * 100,
  );
  // Resolve actual outcome name (Spirit, Argentina, Yes, etc.)
  const idx = prediction.pick === "Yes" ? 0 : 1;
  const sideName = (market.outcomes[idx] ?? prediction.pick).toUpperCase();
  const sideDisplay = sideName.length <= 12 ? sideName : sideName.slice(0, 11) + "…";

  return (
    <div
      className="fixed bottom-6 right-6 z-[300] transition-all"
      style={{
        transform: `translateY(${visible ? 0 : 20}px)`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "all" : "none",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <a
        href={
          market.eventSlug
            ? `https://polymarket.com/event/${market.eventSlug}`
            : "#"
        }
        target="_blank"
        rel="noopener noreferrer"
        className="flex cursor-pointer items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4 no-underline"
        style={{
          background: "white",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        }}
      >
        <div
          className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
          style={{
            background: `${color}14`,
            border: `1.5px solid ${color}40`,
            color,
          }}
        >
          #{rank}
        </div>
        <span
          className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium"
          style={{ color: "var(--text)" }}
        >
          {market.question}
        </span>
        <div
          className="flex shrink-0 items-center gap-[7px] pl-2"
          style={{ borderLeft: "1px solid var(--border)" }}
        >
          <span
            className="mono text-[13px] font-extrabold"
            style={{ color }}
          >
            BUY {sideDisplay}
          </span>
          <span
            className="mono text-[11px]"
            style={{ color: "var(--faint)" }}
          >
            {edge >= 0 ? "+" : "−"}
            {Math.abs(edge)}¢
          </span>
        </div>
      </a>
    </div>
  );
}
