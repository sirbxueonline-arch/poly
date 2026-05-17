"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  text: string | null;
  loading: boolean;
  /** "PULSE / TAKE" (default) or e.g. "ONE / MORE" for the bottom editorial beat */
  label?: [string, string];
  /** Question this take is *about* — shown as attribution under the quote */
  attribution?: string | null;
};

export function PulseTake({
  text,
  loading,
  label = ["PULSE", "TAKE"],
  attribution,
}: Props) {
  const hasText = !!text;

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-5">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-stretch overflow-hidden rounded-xl"
        style={{
          background: "#ffffff",
          border: "1px solid #e6e3dc",
          borderTop: "3px solid #b45309",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px rgba(15,15,15,0.06)",
        }}
      >
        {/* Dark left tile — explicit hex so CSS-var indirection can't fail */}
        <div
          className="relative flex shrink-0 flex-col items-center justify-center px-5 py-4"
          style={{
            background: "#0a0a0a",
            minWidth: 92,
            backgroundImage:
              "radial-gradient(160px 80px at 50% 120%, rgba(180,83,9,0.25), transparent 70%)",
          }}
        >
          <span
            className="mono text-[11px] font-extrabold leading-none tracking-[0.18em]"
            style={{ color: "#ffffff" }}
          >
            {label[0]}
          </span>
          <span
            className="mono mt-1 text-[11px] font-extrabold leading-none tracking-[0.18em]"
            style={{ color: "#fbbf24" }}
          >
            {label[1]}
          </span>
          <span
            className="mono mt-2 text-[8px] tracking-[0.18em]"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            GPT-4o-mini
          </span>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            {hasText ? (
              <motion.div
                key={text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                <p
                  className="text-[16px] font-medium leading-[1.5]"
                  style={{ color: "#0a0a0a" }}
                >
                  <span
                    aria-hidden
                    className="mr-0.5"
                    style={{ color: "#b45309" }}
                  >
                    “
                  </span>
                  {text}
                  <span
                    aria-hidden
                    className="ml-0.5"
                    style={{ color: "#b45309" }}
                  >
                    ”
                  </span>
                </p>
                {attribution && (
                  <p
                    className="mono mt-2 truncate text-[11px] tracking-[0.04em]"
                    style={{ color: "#a1a1aa" }}
                  >
                    — on “{attribution}”
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={loading ? "thinking" : "idle"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <ThinkingDots />
                <span
                  className="mono text-[12px] tracking-[0.14em]"
                  style={{ color: "#71717a" }}
                >
                  {loading
                    ? "AI IS READING THE BOARD…"
                    : "AWAITING NEXT DIGEST"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: "#b45309" }}
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
