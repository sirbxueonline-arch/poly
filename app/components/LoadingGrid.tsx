"use client";

import { motion } from "framer-motion";

/**
 * Loading state shown on first paint before the markets API has returned.
 * Gives the page real structure (a status banner + skeleton cards) so the
 * empty state doesn't look broken.
 */
export function LoadingGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-8">
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5 flex items-center gap-3 overflow-hidden rounded-xl px-5 py-3.5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <ThinkingDots />
        <div className="flex flex-col gap-0.5 leading-tight">
          <span
            className="mono text-[11px] font-bold tracking-[0.14em]"
            style={{ color: "var(--text)" }}
          >
            SCANNING POLYMARKET
          </span>
          <span
            className="mono text-[10px] tracking-[0.1em]"
            style={{ color: "var(--faint)" }}
          >
            Fetching live markets · this only takes a few seconds
          </span>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 sm:flex">
          <div
            aria-hidden
            className="h-1.5 w-1.5 rounded-full ppulse"
            style={{ background: "#10b981" }}
          />
          <span
            className="mono text-[10px] tracking-[0.12em]"
            style={{ color: "var(--faint)" }}
          >
            POLLING gamma-api
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} delay={i * 40} />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fcfbf8 100%)",
        border: "1px solid var(--border)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.04), 0 4px 14px -2px rgba(0,0,0,0.06)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: 3,
          borderRadius: "16px 16px 0 0",
          background:
            "linear-gradient(90deg, #d6d3c9, rgba(214,211,201,0.4), transparent)",
        }}
      />
      <div className="space-y-3.5 px-[18px] pb-[18px] pt-4">
        {/* meta row */}
        <div className="flex items-center gap-1.5">
          <div className="skeleton h-4 w-10 rounded" />
          <div className="skeleton h-3 w-14 rounded" />
          <div className="ml-auto skeleton h-3 w-6 rounded" />
        </div>
        {/* question */}
        <div className="space-y-1.5">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
        </div>
        {/* verdict block placeholder */}
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(7, 89, 80, 0.04)",
            borderTop: "3px solid #d6d3c9",
          }}
        >
          <div className="mono mb-1.5 text-[9px] tracking-[0.18em] text-zinc-400">
            AI RULING · LOADING…
          </div>
          <div className="skeleton mb-2 h-7 w-32 rounded" />
          <div className="mb-2 flex items-center gap-2">
            <div className="flex flex-1 gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton h-1 flex-1 rounded" />
              ))}
            </div>
          </div>
          <div className="skeleton h-1.5 w-full rounded-full" />
        </div>
        {/* chart placeholder */}
        <div className="skeleton h-[140px] w-full rounded-xl" />
        {/* context strip */}
        <div className="flex items-center gap-2">
          <div className="skeleton h-4 w-14 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 flex-1 rounded" />
        </div>
        {/* footer buttons */}
        <div
          className="flex gap-2 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="skeleton h-7 flex-1 rounded-md" />
          <div className="skeleton h-7 flex-1 rounded-md" />
        </div>
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: "#10b981" }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
