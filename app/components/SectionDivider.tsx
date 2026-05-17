"use client";

type Pick = "Yes" | "No" | "Pass";

type Props = {
  pick: Pick;
  count: number;
  urgency?: boolean;
};

const COLORS: Record<Pick, { fg: string; bg: string }> = {
  Yes: { fg: "#047857", bg: "#d1fae5" },
  No: { fg: "#b91c1c", bg: "#fee2e2" },
  Pass: { fg: "#71717a", bg: "#f4f4f5" },
};

export function SectionDivider({ pick, count, urgency = false }: Props) {
  const color = urgency
    ? { fg: "var(--amber)", bg: "var(--amber-bg)" }
    : COLORS[pick];
  const label = urgency ? "CLOSING SOON" : `BUY ${pick.toUpperCase()} PICKS`;

  return (
    <div className="sticky top-14 z-[100] mx-auto max-w-[1200px] px-8 pb-3 pt-2">
      <div
        className="flex items-center gap-2.5 rounded-lg px-4 py-2"
        style={{
          background: color.bg,
          border: `1px solid ${color.fg}25`,
        }}
      >
        {urgency && (
          <div
            aria-hidden
            className="h-[7px] w-[7px] rounded-full ppulse-rose"
            style={{ background: "var(--no)" }}
          />
        )}
        <span
          className="mono text-[11px] font-bold tracking-[0.14em]"
          style={{ color: color.fg }}
        >
          → {label}
        </span>
        <span
          className="mono text-[11px] tracking-[0.08em]"
          style={{ color: `${color.fg}90` }}
        >
          {count} market{count !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
