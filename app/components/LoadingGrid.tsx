"use client";

/**
 * Skeleton grid shown during initial market fetch so the page has structure
 * before any real data lands. Roughly mirrors the real card layout: meta row,
 * question, verdict block, chart, footer.
 */
export function LoadingGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-1 pt-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
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
          background: "linear-gradient(90deg, #d6d3c9, transparent)",
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
            background: "rgba(7, 89, 80, 0.05)",
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
        <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="skeleton h-7 flex-1 rounded-md" />
          <div className="skeleton h-7 flex-1 rounded-md" />
        </div>
      </div>
    </div>
  );
}
