"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompactRow } from "./components/CompactRow";
import {
  Controls,
  TIME_FILTER_HOURS,
  type Density,
  type SortKey,
  type TimeFilter,
} from "./components/Controls";
import { Featured } from "./components/Featured";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { MarketCard } from "./components/MarketCard";
import { PulseTake } from "./components/PulseTake";
import { SectionDivider } from "./components/SectionDivider";
import { StatsStrip, type PickFilter } from "./components/StatsStrip";
import { StickyPill } from "./components/StickyPill";
import type { AIPrediction, Category } from "./lib/ai";
import { buildPriceMap, scoreMarkets } from "./lib/score";
import type { RawMarket, ScoredMarket } from "./lib/types";

/**
 * Live market poll cadence (charts + momentum).
 *
 * Was 1s — that was too aggressive: 60 req/min/tab against the Polymarket
 * proxy, and every poll forced a full React reconciliation across 50 cards.
 * 5s is plenty: the Polymarket embed iframes update themselves in real time,
 * so we don't need browser-side momentum sampling that fast.
 */
const MARKET_POLL_MS = 5_000;
/** Predictions cache poll cadence — server only refreshes every 5 min. */
const PREDICTIONS_POLL_MS = 30_000;

type Status = "loading" | "ok" | "error";

type ServerPrediction = {
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

type PredictionsResponse = {
  predictions: ServerPrediction[];
  pulseTake: string | null;
  refreshing: boolean;
  activeWorkers: number;
  lastDigestAt: number | null;
  nextDigestAt: number | null;
  ageMs: number | null;
  msUntilNext: number;
  refreshIntervalMs: number;
  kickedOffRefresh: boolean;
  notConfigured?: boolean;
  configurationHelp?: string;
};

type AIState = {
  pulseTake: string | null;
  reasons: Record<string, string>;
  categories: Record<string, Category>;
  predictions: Record<string, AIPrediction>;
  refreshing: boolean;
  activeWorkers: number;
  lastDigestAt: number | null;
  nextDigestAt: number | null;
  refreshIntervalMs: number;
  configured: boolean;
  /** Has the first /api/predictions call returned at least once? */
  hydrated: boolean;
};

const EMPTY_AI: AIState = {
  pulseTake: null,
  reasons: {},
  categories: {},
  predictions: {},
  refreshing: false,
  activeWorkers: 0,
  lastDigestAt: null,
  nextDigestAt: null,
  refreshIntervalMs: 5 * 60 * 1000,
  configured: true,
  hydrated: false,
};

export default function Page() {
  const [markets, setMarkets] = useState<ScoredMarket[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [trackedCount, setTrackedCount] = useState(0);
  const [ai, setAi] = useState<AIState>(EMPTY_AI);
  const [filter, setFilter] = useState<PickFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [density, setDensity] = useState<Density>("comfort");
  const [pickChanges, setPickChanges] = useState<
    Record<string, "new" | "flipped">
  >({});
  const [secondsToNext, setSecondsToNext] = useState<number | null>(null);
  const [pillVisible, setPillVisible] = useState(false);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);

  const prevPricesRef = useRef<Map<string, number[]>>(new Map());
  const marketsInflightRef = useRef<boolean>(false);
  const predictionsInflightRef = useRef<boolean>(false);
  const hasDataRef = useRef<boolean>(false);
  const prevPredictionsRef = useRef<Record<string, AIPrediction>>({});

  /* ────────────────────────────────────────────────────────────
   * Polymarket polling (live data for charts + momentum)
   * ────────────────────────────────────────────────────────── */

  const fetchMarkets = useCallback(async () => {
    if (marketsInflightRef.current) return;
    marketsInflightRef.current = true;
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = (await res.json()) as RawMarket[] | { error?: string };
      if (!Array.isArray(data)) {
        const msg =
          (data as { error?: string })?.error ?? "Unexpected response shape";
        throw new Error(msg);
      }

      const scored = scoreMarkets(data, prevPricesRef.current);
      prevPricesRef.current = buildPriceMap(data);

      setMarkets(scored);
      setTrackedCount(data.length);
      setStatus("ok");
      setErrorMessage(null);
      setTick((t) => t + 1);
      hasDataRef.current = true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load markets";
      setErrorMessage(message);
      if (!hasDataRef.current) setStatus("error");
    } finally {
      marketsInflightRef.current = false;
    }
  }, []);

  /* ────────────────────────────────────────────────────────────
   * Predictions polling (server-cached, refreshed every 5 min)
   * ────────────────────────────────────────────────────────── */

  const fetchPredictions = useCallback(async () => {
    if (predictionsInflightRef.current) return;
    predictionsInflightRef.current = true;
    try {
      const res = await fetch("/api/predictions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as PredictionsResponse;

      if (data.notConfigured) {
        setSetupNotice(data.configurationHelp ?? "Supabase not configured");
      } else {
        setSetupNotice(null);
      }

      const reasons: Record<string, string> = {};
      const categories: Record<string, Category> = {};
      const predictions: Record<string, AIPrediction> = {};
      for (const p of data.predictions) {
        if (p.reason) reasons[p.id] = p.reason;
        if (p.category) categories[p.id] = p.category;
        predictions[p.id] = p.prediction;
      }

      // Diff against previous tick to drive NEW / FLIPPED badges.
      const prev = prevPredictionsRef.current;
      const changes: Record<string, "new" | "flipped"> = {};
      for (const [id, pred] of Object.entries(predictions)) {
        const last = prev[id];
        if (pred.pick === "Pass") continue;
        if (!last || last.pick === "Pass") changes[id] = "new";
        else if (last.pick !== pred.pick) changes[id] = "flipped";
      }
      prevPredictionsRef.current = predictions;
      setPickChanges(changes);

      setAi({
        pulseTake: data.pulseTake,
        reasons,
        categories,
        predictions,
        refreshing: data.refreshing,
        activeWorkers: data.activeWorkers,
        lastDigestAt: data.lastDigestAt,
        nextDigestAt: data.nextDigestAt,
        refreshIntervalMs: data.refreshIntervalMs,
        configured: true,
        hydrated: true,
      });
    } catch (err) {
      console.warn("predictions poll failed:", err);
    } finally {
      predictionsInflightRef.current = false;
    }
  }, []);

  // Initial fetches + intervals (pauses while tab is hidden)
  useEffect(() => {
    let mId: number | null = null;
    let pId: number | null = null;

    const start = () => {
      void fetchMarkets();
      void fetchPredictions();
      if (mId !== null) window.clearInterval(mId);
      if (pId !== null) window.clearInterval(pId);
      mId = window.setInterval(() => void fetchMarkets(), MARKET_POLL_MS);
      pId = window.setInterval(
        () => void fetchPredictions(),
        PREDICTIONS_POLL_MS,
      );
    };
    const stop = () => {
      if (mId !== null) window.clearInterval(mId);
      if (pId !== null) window.clearInterval(pId);
      mId = null;
      pId = null;
    };

    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [fetchMarkets, fetchPredictions]);

  // While a server refresh is in flight, poll predictions a bit faster so we
  // pick up the new data within seconds of it landing. Skipped when tab hidden.
  useEffect(() => {
    if (!ai.refreshing) return;
    if (document.visibilityState !== "visible") return;
    const id = window.setInterval(() => void fetchPredictions(), 2000);
    return () => window.clearInterval(id);
  }, [ai.refreshing, fetchPredictions]);

  // Header countdown ticker — derived from server's nextDigestAt.
  useEffect(() => {
    if (!ai.nextDigestAt) {
      setSecondsToNext(null);
      return;
    }
    const update = () =>
      setSecondsToNext(
        Math.max(0, Math.ceil((ai.nextDigestAt! - Date.now()) / 1000)),
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [ai.nextDigestAt]);

  // Sticky pill after scroll
  useEffect(() => {
    function onScroll() {
      setPillVisible(window.scrollY > 320);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLoading = status === "loading";
  const isError = status === "error";

  /* ────────────────────────────────────────────────────────────
   * Derived data
   * ────────────────────────────────────────────────────────── */

  // Stats for the strip
  const pickStats = useMemo(() => {
    let buyYes = 0;
    let buyNo = 0;
    let pass = 0;
    let edgeSum = 0;
    let edgeCount = 0;
    for (const m of markets) {
      const pred = ai.predictions[m.id];
      if (!pred) continue;
      if (pred.pick === "Yes") buyYes++;
      else if (pred.pick === "No") buyNo++;
      else pass++;
      if (pred.pick !== "Pass") {
        const yp = m.prices[0];
        const edge =
          pred.pick === "Yes" ? pred.fairValue - yp : yp - pred.fairValue;
        edgeSum += Math.abs(edge);
        edgeCount++;
      }
    }
    return {
      buyYes,
      buyNo,
      pass,
      avgEdgeCents: edgeCount > 0 ? (edgeSum / edgeCount) * 100 : 0,
    };
  }, [markets, ai.predictions]);

  const bestEdgeId = useMemo(() => {
    let id: string | null = null;
    let max = 0;
    for (const m of markets) {
      const pred = ai.predictions[m.id];
      if (!pred || pred.pick === "Pass") continue;
      const yp = m.prices[0];
      const edge =
        pred.pick === "Yes" ? pred.fairValue - yp : yp - pred.fairValue;
      if (edge > max) {
        max = edge;
        id = m.id;
      }
    }
    return id;
  }, [markets, ai.predictions]);

  // Filter + sort -> visibleMarkets
  const visibleMarkets = useMemo(() => {
    const hoursLimit = TIME_FILTER_HOURS[timeFilter];
    const now = Date.now();

    const filtered = markets.filter((m) => {
      if (filter !== "all") {
        const pred = ai.predictions[m.id];
        if (!pred) return false;
        if (filter === "yes" && pred.pick !== "Yes") return false;
        if (filter === "no" && pred.pick !== "No") return false;
        if (filter === "pass" && pred.pick !== "Pass") return false;
      }
      if (timeFilter !== "any") {
        if (!m.endDate) return false;
        const ms = new Date(m.endDate).getTime() - now;
        if (!Number.isFinite(ms) || ms <= 0) return false;
        if (ms / 3_600_000 > hoursLimit) return false;
      }
      return true;
    });

    if (sortBy === "score") return filtered;

    const confRank = { high: 3, medium: 2, low: 1 } as const;
    filtered.sort((a, b) => {
      const pa = ai.predictions[a.id];
      const pb = ai.predictions[b.id];
      if (sortBy === "edge") {
        const ea =
          pa && pa.pick !== "Pass" ? Math.abs(pa.fairValue - a.prices[0]) : 0;
        const eb =
          pb && pb.pick !== "Pass" ? Math.abs(pb.fairValue - b.prices[0]) : 0;
        return eb - ea;
      }
      if (sortBy === "volume") return b.volume24hr - a.volume24hr;
      if (sortBy === "momentum")
        return Math.abs(b.momentum) - Math.abs(a.momentum);
      if (sortBy === "conviction") {
        const ca = pa ? confRank[pa.confidence] : 0;
        const cb = pb ? confRank[pb.confidence] : 0;
        return cb - ca;
      }
      return 0;
    });
    return filtered;
  }, [markets, ai.predictions, filter, sortBy, timeFilter]);

  const isFiltered = filter !== "all" || timeFilter !== "any";

  // Section partitioning
  const featured = visibleMarkets[0];
  const featuredId = featured?.id;
  const isPickKnown = (m: ScoredMarket, pick: "Yes" | "No" | "Pass") =>
    ai.predictions[m.id]?.pick === pick;

  const yesPicks = visibleMarkets.filter(
    (m) => isPickKnown(m, "Yes") && m.id !== featuredId,
  );
  const noPicks = visibleMarkets.filter(
    (m) => isPickKnown(m, "No") && m.id !== featuredId,
  );
  const passPicks = visibleMarkets.filter((m) => isPickKnown(m, "Pass"));
  const urgent = visibleMarkets.filter((m) => {
    if (m.id === featuredId) return false;
    if (!m.endDate) return false;
    const ms = new Date(m.endDate).getTime() - Date.now();
    return Number.isFinite(ms) && ms > 0 && ms / 3_600_000 <= 1;
  });
  const noPrediction = visibleMarkets.filter(
    (m) => !ai.predictions[m.id] && m.id !== featuredId,
  );

  // Bottom Pulse Take target: the highest-conviction No pick if there is one
  const oneMoreMarket = visibleMarkets.find(
    (m) => ai.predictions[m.id]?.pick === "No" && m.id !== featuredId,
  );

  return (
    <div className="min-h-screen pb-20" style={{ background: "var(--bg)" }}>
      <Header
        tick={tick}
        secondsToNext={secondsToNext}
        intervalSeconds={ai.refreshIntervalMs / 1000}
        trackedCount={trackedCount}
        isPolling={!isError}
        hasError={isError}
        refreshing={ai.refreshing}
        activeWorkers={ai.activeWorkers}
        lastDigestAt={ai.lastDigestAt}
      />

      {/* Hero */}
      <div className="mx-auto max-w-[1200px] px-8 pb-6 pt-12">
        <div
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-[5px]"
          style={{
            background: "var(--amber-bg)",
            border: "1px solid rgba(180,83,9,0.18)",
          }}
        >
          <div
            aria-hidden
            className="h-1.5 w-1.5 rounded-full ppulse-amber"
            style={{ background: "var(--amber)" }}
          />
          <span
            className="mono text-[11px] font-bold tracking-[0.14em]"
            style={{ color: "var(--amber)" }}
          >
            LIVE SCANNER
          </span>
        </div>
        <h1
          className="mono mb-2 text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em]"
          style={{ color: "var(--text)" }}
        >
          Top movers,
          <br />
          right now.
        </h1>
        <p
          className="max-w-[460px] text-[15px] leading-[1.6]"
          style={{ color: "var(--muted)" }}
        >
          {visibleMarkets.length} live prediction markets scored for momentum,
          edge, and AI conviction. Prices live; AI refresh every 5 min.
        </p>
      </div>

      {setupNotice && (
        <div className="mx-auto max-w-[1200px] px-8 pb-5">
          <div
            className="flex flex-col gap-2 rounded-xl px-5 py-4"
            style={{
              background: "var(--amber-bg)",
              border: "1px solid rgba(180,83,9,0.25)",
            }}
          >
            <div
              className="mono text-[10px] font-bold tracking-[0.16em]"
              style={{ color: "var(--amber)" }}
            >
              SUPABASE NOT CONFIGURED
            </div>
            <div className="text-[13px] leading-[1.55]" style={{ color: "var(--text)" }}>
              {setupNotice}
            </div>
            <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>
              See <code>supabase/schema.sql</code> in the project root.
            </div>
          </div>
        </div>
      )}

      <PulseTake
        text={ai.pulseTake}
        loading={ai.refreshing && !ai.pulseTake}
        label={["PULSE", "TAKE"]}
        attribution={featured?.question ?? null}
      />

      <StatsStrip
        tracking={markets.length}
        buyYes={pickStats.buyYes}
        buyNo={pickStats.buyNo}
        pass={pickStats.pass}
        avgEdgeCents={pickStats.avgEdgeCents}
        tick={tick}
        filter={filter}
        onFilterChange={setFilter}
      />

      <Controls
        sort={sortBy}
        onSortChange={setSortBy}
        time={timeFilter}
        onTimeChange={setTimeFilter}
        density={density}
        onDensityChange={setDensity}
      />

      {/* Featured card */}
      {featured && (
        <Featured
          market={featured}
          prediction={ai.predictions[featured.id]}
          category={ai.categories[featured.id]}
        />
      )}

      {/* ─── BUY YES ─── */}
      {(filter === "all" || filter === "yes") && yesPicks.length > 0 && (
        <>
          <SectionDivider pick="Yes" count={yesPicks.length} />
          <div className="mx-auto max-w-[1200px] px-8 pb-1 pt-3">
            <SectionGrid
              markets={yesPicks}
              density={density}
              renderCard={(m) => (
                <MarketCard
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  aiReason={ai.reasons[m.id]}
                  category={ai.categories[m.id]}
                  prediction={ai.predictions[m.id]}
                  isBestEdge={m.id === bestEdgeId}
                  pickChange={pickChanges[m.id]}
                  aiLoading={ai.refreshing}
                  aiConfigured={ai.configured}
                />
              )}
              renderCompact={(m) => (
                <CompactRow
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  prediction={ai.predictions[m.id]}
                />
              )}
            />
          </div>
        </>
      )}

      {/* ─── BUY NO ─── */}
      {(filter === "all" || filter === "no") && noPicks.length > 0 && (
        <>
          <SectionDivider pick="No" count={noPicks.length} />
          <div className="mx-auto max-w-[1200px] px-8 pb-1 pt-3">
            <SectionGrid
              markets={noPicks}
              density={density}
              renderCard={(m) => (
                <MarketCard
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  aiReason={ai.reasons[m.id]}
                  category={ai.categories[m.id]}
                  prediction={ai.predictions[m.id]}
                  isBestEdge={m.id === bestEdgeId}
                  pickChange={pickChanges[m.id]}
                  aiLoading={ai.refreshing}
                  aiConfigured={ai.configured}
                />
              )}
              renderCompact={(m) => (
                <CompactRow
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  prediction={ai.predictions[m.id]}
                />
              )}
            />
          </div>
        </>
      )}

      {/* ─── PASS (always compact) ─── */}
      {(filter === "all" || filter === "pass") && passPicks.length > 0 && (
        <>
          <SectionDivider pick="Pass" count={passPicks.length} />
          <div className="mx-auto max-w-[1200px] px-8 pb-1 pt-3">
            <div className="flex flex-col gap-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {passPicks.map((m) => (
                  <CompactRow
                    key={m.id}
                    market={m}
                    rank={markets.findIndex((x) => x.id === m.id) + 1}
                    prediction={ai.predictions[m.id]}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {/* ─── CLOSING SOON ─── */}
      {filter === "all" && urgent.length > 0 && (
        <>
          <SectionDivider pick="Yes" count={urgent.length} urgency />
          <div className="mx-auto max-w-[1200px] px-8 pb-1 pt-3">
            <SectionGrid
              markets={urgent}
              density={density}
              renderCard={(m) => (
                <MarketCard
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  aiReason={ai.reasons[m.id]}
                  category={ai.categories[m.id]}
                  prediction={ai.predictions[m.id]}
                  isBestEdge={m.id === bestEdgeId}
                  pickChange={pickChanges[m.id]}
                  aiLoading={ai.refreshing}
                  aiConfigured={ai.configured}
                />
              )}
              renderCompact={(m) => (
                <CompactRow
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  prediction={ai.predictions[m.id]}
                />
              )}
            />
          </div>
        </>
      )}

      {/* ─── No prediction yet ─── */}
      {filter === "all" && noPrediction.length > 0 && density === "comfort" && (
        <>
          <div className="mx-auto max-w-[1200px] px-8 pb-3 pt-6">
            <div
              className="mono text-[10px] tracking-[0.14em]"
              style={{ color: "var(--faint)" }}
            >
              → AWAITING AI ANALYSIS · {noPrediction.length} market
              {noPrediction.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="mx-auto max-w-[1200px] px-8 pb-1">
            <SectionGrid
              markets={noPrediction.slice(0, 9)}
              density={density}
              renderCard={(m) => (
                <MarketCard
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  aiReason={ai.reasons[m.id]}
                  category={ai.categories[m.id]}
                  prediction={ai.predictions[m.id]}
                  isBestEdge={m.id === bestEdgeId}
                  pickChange={pickChanges[m.id]}
                  aiLoading={ai.refreshing}
                  aiConfigured={ai.configured}
                />
              )}
              renderCompact={(m) => (
                <CompactRow
                  market={m}
                  rank={markets.findIndex((x) => x.id === m.id) + 1}
                  prediction={ai.predictions[m.id]}
                />
              )}
            />
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && visibleMarkets.length === 0 && (
        <div className="mx-auto max-w-[1200px] px-8 py-4">
          <div
            className="mono rounded-[10px] border border-dashed py-6 text-center text-[13px] tracking-[0.1em]"
            style={{ borderColor: "var(--border)", color: "var(--faint)" }}
          >
            NO MARKETS MATCH THIS FILTER
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="mx-auto max-w-[1200px] px-8 py-4">
          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{
              borderColor: "var(--no)",
              background: "var(--no-bg)",
              color: "var(--no)",
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--no)" }}
            />
            <span className="text-[13px] font-medium">
              Couldn't reach Polymarket: {errorMessage}
            </span>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                void fetchMarkets();
              }}
              className="mono ml-auto cursor-pointer rounded-md border bg-white px-2.5 py-1 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "var(--no)", color: "var(--no)" }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Bottom Pulse Take ("One More") */}
      {oneMoreMarket && ai.predictions[oneMoreMarket.id]?.thesis && (
        <PulseTake
          text={ai.predictions[oneMoreMarket.id]!.thesis}
          loading={false}
          label={["ONE", "MORE"]}
          attribution={oneMoreMarket.question}
        />
      )}

      <Footer tick={tick} />

      {featured && (
        <StickyPill
          market={featured}
          prediction={ai.predictions[featured.id]}
          rank={markets.findIndex((x) => x.id === featured.id) + 1}
          visible={pillVisible}
        />
      )}
    </div>
  );
}

function SectionGrid({
  markets,
  density,
  renderCard,
  renderCompact,
}: {
  markets: ScoredMarket[];
  density: Density;
  renderCard: (m: ScoredMarket) => React.ReactNode;
  renderCompact: (m: ScoredMarket) => React.ReactNode;
}) {
  if (density === "compact") {
    return (
      <div className="flex flex-col gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {markets.map((m) => (
            <div key={m.id}>{renderCompact(m)}</div>
          ))}
        </AnimatePresence>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {markets.map((m) => (
          <div key={m.id}>{renderCard(m)}</div>
        ))}
      </AnimatePresence>
    </div>
  );
}
