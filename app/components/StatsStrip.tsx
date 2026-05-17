"use client";

export type PickFilter = "all" | "yes" | "no" | "pass";

type Props = {
  tracking: number;
  buyYes: number;
  buyNo: number;
  pass: number;
  avgEdgeCents: number;
  tick: number;
  filter: PickFilter;
  onFilterChange: (next: PickFilter) => void;
};

type Cell = {
  label: string;
  val: string | number;
  active: boolean;
  onClick: (() => void) | null;
  tint: string | null;
};

export function StatsStrip({
  tracking,
  buyYes,
  buyNo,
  pass,
  avgEdgeCents,
  tick,
  filter,
  onFilterChange,
}: Props) {
  const cells: Cell[] = [
    {
      label: "TRACKING",
      val: tracking,
      active: filter === "all",
      onClick: () => onFilterChange("all"),
      tint: null,
    },
    {
      label: "BUY YES",
      val: buyYes,
      active: filter === "yes",
      onClick: () => onFilterChange(filter === "yes" ? "all" : "yes"),
      tint: "var(--yes)",
    },
    {
      label: "BUY NO",
      val: buyNo,
      active: filter === "no",
      onClick: () => onFilterChange(filter === "no" ? "all" : "no"),
      tint: "var(--no)",
    },
    {
      label: "PASS",
      val: pass,
      active: filter === "pass",
      onClick: () => onFilterChange(filter === "pass" ? "all" : "pass"),
      tint: "var(--pass)",
    },
    {
      label: "AVG EDGE",
      val: `${avgEdgeCents.toFixed(1)}¢`,
      active: false,
      onClick: null,
      tint: "var(--amber)",
    },
    {
      label: "TICK #",
      val: String(tick).padStart(4, "0"),
      active: false,
      onClick: null,
      tint: null,
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-4">
      <div
        className="flex overflow-hidden rounded-[10px]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {cells.map((c, i) => {
          const tinted = c.active && c.tint;
          return (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick ?? undefined}
              disabled={!c.onClick}
              className="flex-1 px-4 py-3 text-center transition-colors"
              style={{
                borderRight: i < cells.length - 1 ? "1px solid var(--border)" : "none",
                cursor: c.onClick ? "pointer" : "default",
                background: tinted ? `${c.tint}10` : "transparent",
              }}
              aria-pressed={c.active}
            >
              <div
                className="mono mb-1 text-[9px] tracking-[0.14em]"
                style={{ color: tinted ? c.tint! : "var(--faint)" }}
              >
                {c.label}
              </div>
              <div
                className="mono text-[20px] font-extrabold"
                style={{ color: tinted ? c.tint! : "var(--text)" }}
              >
                {c.val}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
