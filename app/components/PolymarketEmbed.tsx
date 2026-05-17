"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  eventSlug: string | null;
  marketSlug: string;
  question: string;
  /** Current Yes-side probability (0..1) — used by the lightweight sparkline */
  yesPrice: number;
  /** AI pick — colors the sparkline */
  pick?: "Yes" | "No" | "Pass";
  featured?: boolean;
};

const PICK_COLORS = {
  Yes: "#047857",
  No: "#b91c1c",
  Pass: "#71717a",
} as const;

function buildEmbedUrl(_eventSlug: string | null, marketSlug: string): string {
  const params = new URLSearchParams({
    market: marketSlug,
    features: "volume,outcomes,buy,chart",
    theme: "light",
  });
  return `https://embed.polymarket.com/market.html?${params.toString()}`;
}

/**
 * Chart inside a market card.
 *
 * MEMORY NOTE — IMPORTANT.
 * Each Polymarket iframe loads a full third-party page with its own JS bundle
 * and isolated process in Chromium. 50 cards × ~150MB/iframe = several GB of
 * browser memory, which compounded with the dev-server footprint was tipping
 * the user's machine into OOM/thermal territory.
 *
 * We now render a *real* iframe ONLY when `featured` is true (a single card).
 * All other cards get a static SVG sparkline drawn from the current Yes price.
 * No external resources, no extra DOM, no third-party JS.
 */
export function PolymarketEmbed({
  eventSlug,
  marketSlug,
  question,
  yesPrice,
  pick = "Pass",
  featured = false,
}: Props) {
  if (featured) {
    return (
      <FeaturedIframe
        eventSlug={eventSlug}
        marketSlug={marketSlug}
        question={question}
      />
    );
  }
  return <SparkChart yesPrice={yesPrice} pick={pick} />;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Featured-only iframe (still IntersectionObserver-gated so it doesn't load
 * unless visible — though normally the featured card is above the fold)
 * ─────────────────────────────────────────────────────────────────────── */

function FeaturedIframe({
  eventSlug,
  marketSlug,
  question,
}: {
  eventSlug: string | null;
  marketSlug: string;
  question: string;
}) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const src = buildEmbedUrl(eventSlug, marketSlug);

  return (
    <div
      ref={containerRef}
      className="relative isolate overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,1),0_1px_2px_rgba(15,15,15,0.04)]"
      style={{ height: 320 }}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/90 px-2 py-0.5 backdrop-blur-sm transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="pulse-dot" />
        <span className="mono text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-600">
          Polymarket live
        </span>
      </div>

      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
          <div className="flex w-full max-w-[180px] flex-col gap-1.5">
            <div className="skeleton h-2 rounded-full" />
            <div className="skeleton h-2 w-3/4 rounded-full" />
          </div>
          <div className="skeleton h-20 w-full max-w-[260px] rounded-md" />
          <span className="mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">
            Loading live chart
          </span>
        </div>
      )}

      {inView && (
        <iframe
          src={src}
          title={`Polymarket live chart — ${question}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Lightweight SVG sparkline — no iframe, no external resources
 *
 * Deterministic path seeded by the price, so reloads don't redraw randomly.
 * The line ends exactly at the current Yes-side price.
 * ─────────────────────────────────────────────────────────────────────── */

function SparkChart({
  yesPrice,
  pick,
}: {
  yesPrice: number;
  pick: "Yes" | "No" | "Pass";
}) {
  const color = PICK_COLORS[pick];
  const cents = Math.round(Math.max(0, Math.min(1, yesPrice)) * 100);

  const W = 340;
  const H = 140;
  const seed = Math.floor(yesPrice * 1000); // stable per-tick
  const path = buildSparkPath(yesPrice, W, H, seed);
  const fillPath = `${path} L${W},${H} L0,${H} Z`;

  return (
    <div
      className="relative isolate overflow-hidden rounded-xl border border-zinc-200/80 bg-white"
      style={{
        height: 140,
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,1), 0 1px 2px rgba(15,15,15,0.04)",
      }}
    >
      {/* Live label */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5"
      >
        <span className="pulse-dot" />
        <span className="mono text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Polymarket
        </span>
      </div>

      {/* Current price overlay */}
      <div className="pointer-events-none absolute bottom-2 right-3 z-10">
        <div
          className="mono text-[20px] font-extrabold leading-none"
          style={{ color }}
        >
          {cents}¢
        </div>
      </div>

      {/* Sparkline */}
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block"
      >
        <path d={fillPath} fill={`${color}14`} />
        <path
          d={path}
          fill="none"
          stroke={`${color}90`}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function buildSparkPath(
  yesPrice: number,
  width: number,
  height: number,
  seed: number,
): string {
  // 8 deterministic points trending toward `yesPrice` with mild jitter.
  const N = 8;
  const points: number[] = [];
  // Start somewhere within ±20% of the current price
  const startBias = ((seed % 41) - 20) / 100;
  let v = clamp01(yesPrice + startBias);
  for (let i = 0; i < N; i++) {
    if (i === N - 1) {
      v = yesPrice;
    } else {
      const noise = (((seed + i * 37) % 23) - 11) / 200; // ±5.5%
      const drift = (yesPrice - v) * 0.22;
      v = clamp01(v + drift + noise);
    }
    points.push(v);
  }
  const step = width / (N - 1);
  const top = height * 0.1;
  const bottom = height * 0.9;
  const span = bottom - top;
  return points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (top + (1 - p) * span).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function clamp01(v: number): number {
  return Math.max(0.02, Math.min(0.98, v));
}
