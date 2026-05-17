"use client";

export type SortKey = "score" | "edge" | "momentum" | "volume" | "conviction";
export type TimeFilter = "any" | "24h" | "10h" | "1h";
export type Density = "comfort" | "compact";

export const TIME_FILTER_HOURS: Record<TimeFilter, number> = {
  any: Infinity,
  "24h": 24,
  "10h": 10,
  "1h": 1,
};

type Props = {
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  time: TimeFilter;
  onTimeChange: (next: TimeFilter) => void;
  density: Density;
  onDensityChange: (next: Density) => void;
};

export function Controls({
  sort,
  onSortChange,
  time,
  onTimeChange,
  density,
  onDensityChange,
}: Props) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-5 px-8 pb-5">
      {/* Sort */}
      <div className="flex items-center gap-1">
        <span
          className="mono mr-1 text-[10px] tracking-[0.12em]"
          style={{ color: "var(--faint)" }}
        >
          SORT
        </span>
        {(["score", "edge", "momentum", "volume"] as const).map((s) => (
          <Pill
            key={s}
            label={s.toUpperCase()}
            active={sort === s}
            onClick={() => onSortChange(s)}
          />
        ))}
      </div>

      <div className="h-5 w-px" style={{ background: "var(--border)" }} />

      {/* Time-to-close */}
      <div className="flex items-center gap-1">
        <span
          className="mono mr-1 text-[10px] tracking-[0.12em]"
          style={{ color: "var(--faint)" }}
        >
          CLOSE
        </span>
        {(
          [
            { v: "any" as const, label: "ANY", color: null },
            { v: "24h" as const, label: "<24H", color: null },
            { v: "10h" as const, label: "<10H", color: "var(--amber)" },
            { v: "1h" as const, label: "<1H", color: "var(--no)" },
          ] as const
        ).map((t) => (
          <Pill
            key={t.v}
            label={t.label}
            active={time === t.v}
            color={t.color ?? undefined}
            onClick={() => onTimeChange(t.v)}
          />
        ))}
      </div>

      <div className="flex-1" />

      {/* Density toggle */}
      <div
        className="flex gap-px rounded-[7px] p-0.5"
        style={{ background: "#ede9e2" }}
      >
        {(
          [
            { v: "comfort" as const, label: "Comfort" },
            { v: "compact" as const, label: "Compact" },
          ] as const
        ).map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => onDensityChange(d.v)}
            aria-pressed={density === d.v}
            className="mono cursor-pointer rounded-[5px] border-none px-3.5 py-[5px] text-[11px] font-semibold tracking-[0.06em] transition-colors"
            style={{
              background: density === d.v ? "var(--text)" : "transparent",
              color: density === d.v ? "white" : "var(--muted)",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="mono cursor-pointer rounded-md border-none px-3 py-[5px] text-[11px] tracking-[0.06em] transition-all"
      style={{
        fontWeight: active ? 700 : 500,
        background: active ? color ?? "var(--text)" : "#ede9e2",
        color: active ? "white" : color ?? "var(--muted)",
      }}
    >
      {label}
    </button>
  );
}
