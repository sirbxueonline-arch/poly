"use client";

import type { AIPrediction } from "@/app/lib/ai";

export type VerdictProps = {
  prediction: AIPrediction;
  marketYesPrice: number;
  /** Raw outcome labels from Polymarket — e.g. ["Yes","No"] or ["Spirit","Team Falcons"] */
  outcomes: string[];
  size?: "sm" | "lg";
  dark?: boolean;
};

/**
 * Build the verdict headline:
 *   binary Yes/No market    → "BUY YES" / "BUY NO" / "PASS"
 *   team-vs-team / multi    → "BUY SPIRIT" / "BUY TEAM FALCONS" / "PASS"
 * Always uppercase, no truncation — the renderer scales font-size to fit.
 */
function pickHeadline(
  pick: "Yes" | "No" | "Pass",
  outcomes: string[],
): string {
  if (pick === "Pass") return "PASS";
  const idx = pick === "Yes" ? 0 : 1;
  const raw = (outcomes[idx] ?? pick).trim();
  return `BUY ${raw.toUpperCase()}`;
}

/** Choose a font-size for the verdict headline that scales with label length. */
function headlineFontSize(headline: string, base: number): number {
  const len = headline.length;
  if (len <= 8) return base;
  if (len <= 12) return Math.round(base * 0.82);
  if (len <= 18) return Math.round(base * 0.66);
  return Math.round(base * 0.54);
}

const PICK_COLORS = {
  Yes: "#047857",
  No: "#b91c1c",
  Pass: "#71717a",
} as const;

const RULING_DATE_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})
  .format(new Date())
  .toUpperCase();

export function Verdict({
  prediction,
  marketYesPrice,
  outcomes,
  size = "sm",
  dark = false,
}: VerdictProps) {
  const color = PICK_COLORS[prediction.pick];
  const isPass = prediction.pick === "Pass";
  const isLg = size === "lg";

  // Probability rail uses 0..100 percent
  const cp = Math.round(Math.max(0, Math.min(1, marketYesPrice)) * 100);
  const fv = Math.round(Math.max(0.01, Math.min(0.99, prediction.fairValue)) * 100);

  // For Pass picks, edge is the gap; sign indicates direction
  const edge = isPass
    ? 0
    : prediction.pick === "Yes"
      ? Math.round((prediction.fairValue - marketYesPrice) * 100)
      : Math.round((marketYesPrice - prediction.fairValue) * 100);
  const edgeAbs = Math.abs(isPass ? cp - fv : edge);
  const edgeSign = isPass ? "" : prediction.pick === "Yes" ? "+" : "−";

  // Confidence -> 0..1 -> 10-bar grid
  const confDecimal =
    prediction.confidence === "high"
      ? 0.9
      : prediction.confidence === "medium"
        ? 0.65
        : 0.35;
  const bars = Math.round(confDecimal * 10);

  // Computed payout for non-Pass picks
  const buyPrice =
    prediction.pick === "Yes"
      ? marketYesPrice
      : prediction.pick === "No"
        ? 1 - marketYesPrice
        : null;
  const payout = buyPrice && buyPrice > 0.01 ? 1 / buyPrice : null;

  const fg = dark ? "rgba(255,255,255,0.9)" : "var(--text)";
  const fgFaint = dark ? "rgba(255,255,255,0.32)" : "var(--faint)";
  const fgMuted = dark ? "rgba(255,255,255,0.55)" : "var(--muted)";
  const panelBg = dark ? `${color}12` : `${color}07`;
  const linedColor = dark ? "rgba(255,255,255,0.04)" : `${color}10`;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        background: panelBg,
        borderTop: `3px solid ${color}`,
        padding: isLg ? "18px 20px" : "13px 16px",
      }}
    >
      {/* Ruled-paper texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(transparent, transparent 19px, ${linedColor} 19px, ${linedColor} 20px)`,
          backgroundPosition: "0 24px",
        }}
      />
      {/* Watermark */}
      <div
        aria-hidden
        className="mono pointer-events-none absolute select-none font-extrabold"
        style={{
          right: -4,
          bottom: -6,
          fontSize: isLg ? 72 : 52,
          color: `${color}07`,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {isPass ? "PASS" : prediction.pick.toUpperCase()}
      </div>

      <div className="relative">
        {/* Top label */}
        <div
          className="mono tracking-[0.18em]"
          style={{
            fontSize: 9,
            color: fgFaint,
            marginBottom: isLg ? 9 : 6,
          }}
        >
          AI RULING · {RULING_DATE_LABEL}
        </div>

        {/* Headline */}
        <div
          className="flex flex-wrap items-end gap-x-2.5 gap-y-1"
          style={{ marginBottom: isLg ? 10 : 6 }}
        >
          {(() => {
            const headline = pickHeadline(prediction.pick, outcomes);
            const baseSize = isLg ? 50 : 28;
            const fontSize = headlineFontSize(headline, baseSize);
            return (
              <div
                className="mono font-extrabold leading-none"
                style={{
                  fontSize,
                  color,
                  letterSpacing: "-0.02em",
                  textWrap: "balance" as never,
                  // Soft directional glow — extra punch on dark featured cards,
                  // subtle on light comfort cards.
                  textShadow:
                    !isPass && dark
                      ? `0 0 28px ${color}88, 0 0 4px ${color}33`
                      : !isPass
                        ? `0 0 12px ${color}22`
                        : undefined,
                }}
                title={headline}
              >
                {headline}
              </div>
            );
          })()}
          {!isPass && payout !== null && (
            <div
              className="mono font-semibold"
              style={{
                fontSize: isLg ? 17 : 12,
                color: dark ? "rgba(255,255,255,0.4)" : "var(--muted)",
                paddingBottom: isLg ? 6 : 3,
              }}
            >
              ×{payout.toFixed(2)}
            </div>
          )}
        </div>

        {/* Certainty bar */}
        <div
          className="flex items-center gap-[7px]"
          style={{ marginBottom: isLg ? 11 : 7 }}
        >
          <span
            className="mono tracking-[0.1em] whitespace-nowrap"
            style={{ fontSize: 9, color: fgFaint }}
          >
            CERTAINTY
          </span>
          <div
            key={`${prediction.pick}-${bars}`}
            className="certainty-pulse flex flex-1 gap-0.5"
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-[2px]"
                style={{
                  height: 4,
                  background: i < bars ? color : `${color}20`,
                  transition: "background 0.4s ease",
                }}
              />
            ))}
          </div>
          <span
            className="mono font-bold"
            style={{ fontSize: 11, color }}
          >
            {Math.round(confDecimal * 100)}%
          </span>
        </div>

        {/* Probability rail */}
        <div>
          <div
            className="mono mb-[5px] flex items-center justify-between tracking-[0.09em]"
            style={{ fontSize: 9, color: fgFaint }}
          >
            <span>NO · 0%</span>
            <span
              className="font-semibold tracking-[0.11em]"
              style={{
                color: dark ? "rgba(255,255,255,0.25)" : "var(--muted)",
              }}
            >
              PROBABILITY RAIL
            </span>
            <span>YES · 100%</span>
          </div>
          <div
            className="relative rounded-[3px]"
            style={{
              height: 6,
              background: dark ? "rgba(255,255,255,0.08)" : "#ede9e1",
            }}
          >
            {/* Edge zone */}
            <div
              className="absolute rounded-[3px]"
              style={{
                height: "100%",
                left: `${Math.min(cp, fv)}%`,
                width: `${Math.abs(fv - cp)}%`,
                background: `${color}38`,
                transition: "left 0.5s ease, width 0.5s ease",
              }}
            />
            {/* Crowd marker */}
            <div
              className="absolute rounded-full"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                left: `calc(${cp}% - 6px)`,
                width: 12,
                height: 12,
                background: dark ? "rgba(255,255,255,0.5)" : "var(--muted)",
                border: `2px solid ${dark ? "#0f0e0c" : "white"}`,
                transition: "left 0.5s ease",
              }}
              title={`Crowd: ${cp}%`}
            />
            {/* AI marker */}
            <div
              className="absolute rounded-full"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                left: `calc(${fv}% - 7px)`,
                width: 14,
                height: 14,
                background: color,
                border: `2px solid ${dark ? "#0f0e0c" : "white"}`,
                transition: "left 0.5s ease",
              }}
              title={`AI fair value: ${fv}%`}
            />
          </div>
          {/* Legend */}
          <div className="mono mt-1.5 flex items-center justify-between text-[10px]">
            <span style={{ color: fgFaint }}>
              CROWD <b style={{ color: fgMuted }}>{cp}%</b>
            </span>
            <span
              className="font-bold tracking-[0.05em]"
              style={{
                background: `${color}18`,
                color,
                padding: "1px 8px",
                borderRadius: 3,
              }}
            >
              {edgeSign}
              {edgeAbs}¢ {isPass ? "GAP" : "EDGE"}
            </span>
            <span style={{ color: fgFaint }}>
              AI <b style={{ color }}>{fv}%</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
