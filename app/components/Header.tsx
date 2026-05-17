"use client";

type Props = {
  tick: number;
  /** Seconds until the next AI refresh — null while we're still hydrating */
  secondsToNext: number | null;
  /** Refresh-interval seconds, used to draw the countdown ring */
  intervalSeconds: number;
  trackedCount: number;
  isPolling: boolean;
  hasError: boolean;
  refreshing: boolean;
  activeWorkers: number;
  /** Epoch ms of the last successful digest */
  lastDigestAt: number | null;
};

export function Header({
  tick,
  secondsToNext,
  intervalSeconds,
  trackedCount,
  isPolling,
  hasError,
  refreshing,
  activeWorkers,
  lastDigestAt,
}: Props) {
  const pct =
    intervalSeconds > 0 && secondsToNext !== null
      ? Math.max(0, Math.min(1, secondsToNext / intervalSeconds))
      : 0;
  const isRefreshing = refreshing;
  const ringColor = isRefreshing ? "#10b981" : "#b45309";

  return (
    <div
      className="sticky top-0 z-[200] border-b backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.92)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "var(--border)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-8">
        <span
          className="mono shrink-0 text-[15px] font-extrabold tracking-[-0.01em]"
          style={{ color: "var(--text)" }}
        >
          POLYPULSE
        </span>

        <div className="h-[18px] w-px" style={{ background: "var(--border)" }} />

        <div className="flex items-center gap-1.5">
          <div
            className={
              isPolling && !hasError
                ? "h-1.5 w-1.5 rounded-full ppulse"
                : "h-1.5 w-1.5 rounded-full"
            }
            style={{
              background: hasError ? "#dc2626" : "#10b981",
              boxShadow:
                isPolling && !hasError
                  ? "0 0 0 3px rgba(16,185,129,0.2)"
                  : "none",
            }}
            aria-hidden
          />
          <span
            className="mono text-[11px] tracking-[0.1em]"
            style={{ color: hasError ? "#dc2626" : "var(--faint)" }}
          >
            {hasError ? "OFFLINE" : "LIVE"}
          </span>
        </div>

        <span
          className="mono text-[11px]"
          style={{ color: "var(--faint)" }}
        >
          Tracking{" "}
          <b style={{ color: "var(--text)" }}>{trackedCount}</b> markets
        </span>

        {lastDigestAt && (
          <span
            className="mono text-[11px]"
            style={{ color: "var(--faint)" }}
            title={new Date(lastDigestAt).toLocaleString()}
          >
            · last AI <b style={{ color: "var(--text)" }}>{formatAgo(lastDigestAt)}</b>
          </span>
        )}

        <div className="flex-1" />

        {/* AI refresh status */}
        <div className="flex items-center gap-1.5">
          {isRefreshing ? (
            <WorkerDots count={Math.min(Math.max(activeWorkers, 1), 5)} />
          ) : (
            <CountdownRing pct={pct} color={ringColor} />
          )}
          <span
            className="mono text-[11px] tracking-[0.1em]"
            style={{ color: isRefreshing ? "#10b981" : "var(--faint)" }}
          >
            {isRefreshing
              ? activeWorkers > 0
                ? `${activeWorkers} WORKER${activeWorkers > 1 ? "S" : ""} ACTIVE`
                : "REFRESHING AI…"
              : secondsToNext === null
                ? "STARTING UP…"
                : `AI IN ${formatCountdown(secondsToNext)}`}
          </span>
        </div>

        <div className="h-[18px] w-px" style={{ background: "var(--border)" }} />

        <span
          className="mono text-[12px] font-bold"
          style={{ color: "var(--faint)" }}
        >
          TICK{" "}
          <span style={{ color: "var(--text)" }}>
            #{String(tick).padStart(4, "0")}
          </span>
        </span>
      </div>
    </div>
  );
}

function formatCountdown(secs: number): string {
  if (secs >= 60) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${Math.max(0, secs)}s`;
}

function formatAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function WorkerDots({ count }: { count: number }) {
  return (
    <div
      className="flex items-center gap-[3px]"
      aria-label={`${count} AI workers active`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="block h-[6px] w-[6px] rounded-full"
          style={{
            background: "#10b981",
            opacity: 0.35,
            animation: `worker-pulse 900ms ease-in-out ${i * 110}ms infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes worker-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

function CountdownRing({ pct, color }: { pct: number; color: string }) {
  const size = 20;
  const stroke = 2;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e6e3dc"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={dash}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}
