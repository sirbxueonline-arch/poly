"use client";

type Props = {
  tick: number;
};

export function Footer({ tick }: Props) {
  return (
    <div
      className="mx-auto mt-[60px] flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-8 py-6"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="mono text-[13px] font-extrabold"
          style={{ color: "var(--text)" }}
        >
          POLYPULSE
        </span>
        <span
          className="mono text-[11px]"
          style={{ color: "var(--faint)" }}
        >
          TICK #{String(tick).padStart(4, "0")}
        </span>
      </div>
      <p
        className="max-w-[560px] flex-1 text-center text-[12px] leading-[1.6]"
        style={{ color: "var(--faint)" }}
      >
        <strong style={{ color: "var(--muted)" }}>Not financial advice.</strong>{" "}
        AI picks are GPT-4o-mini's opinion, not a forecast. Prediction markets
        are speculative. Data sourced from Polymarket via{" "}
        <a
          href="https://gamma-api.polymarket.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--muted)" }}
        >
          gamma-api
        </a>
        . Prices update every second.
      </p>
      <span
        className="mono text-[11px]"
        style={{ color: "var(--faint)" }}
      >
        Data: Polymarket
      </span>
    </div>
  );
}
