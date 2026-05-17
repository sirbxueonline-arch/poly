"use client";

/**
 * Loading state shown on first paint before the markets API has returned.
 * Plain CSS only — no framer-motion. We've seen the motion wrappers fail
 * to animate to visible in some hydration states, leaving the grid invisible.
 */
export function LoadingGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-8">
      {/* Status banner */}
      <div
        className="mb-5 flex items-center gap-3 overflow-hidden rounded-xl px-5 py-3.5"
        style={{
          background: "#ffffff",
          border: "1px solid #e6e3dc",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <ThinkingDots />
        <div className="flex flex-col gap-0.5 leading-tight">
          <span className="mono text-[11px] font-bold tracking-[0.14em] text-zinc-900">
            SCANNING POLYMARKET
          </span>
          <span className="mono text-[10px] tracking-[0.1em] text-zinc-500">
            Fetching live markets · this only takes a few seconds
          </span>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 sm:flex">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "#10b981",
              boxShadow: "0 0 0 3px rgba(16,185,129,0.2)",
              animation: "lg-pulse 1.6s ease-in-out infinite",
            }}
          />
          <span className="mono text-[10px] tracking-[0.12em] text-zinc-500">
            POLLING gamma-api
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <style>{`
        @keyframes lg-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes lg-dot {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
        @keyframes lg-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fcfbf8 100%)",
        border: "1px solid #e6e3dc",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.04), 0 4px 14px -2px rgba(0,0,0,0.06)",
        opacity: 1,
        animation: "lg-fade-in 0.4s ease-out",
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
        <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid #e6e3dc" }}>
          <div className="skeleton h-7 flex-1 rounded-md" />
          <div className="skeleton h-7 flex-1 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{
            background: "#10b981",
            opacity: 0.6,
            animation: `lg-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
