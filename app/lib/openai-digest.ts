import "server-only";

import {
  CATEGORIES,
  CONFIDENCES,
  PICKS,
  type AIDigest,
  type AIPick,
  type Confidence,
  isCategory,
  isConfidence,
  isPick,
} from "./ai";

const MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * The system prompt is the analyst voice + calibration playbook. Identical
 * to the one previously embedded in the API route handler — extracted here
 * so both the HTTP-callable route and the server-side refresh job can share it.
 */
const SYSTEM_PROMPT = `You are a sharp analyst writing live picks for Polymarket Pulse. Your job: TAKE SIDES on prediction markets and back each call with reasoning. Pass is the exception, not the default.

CRITICAL — UNDERSTAND "fairValue" BEFORE YOU WRITE ANYTHING:
fairValue is the probability that the "Yes" outcome resolves TRUE, as a decimal between 0.01 and 0.99.
- fairValue = 0.02 means "I think there's a 2% chance Yes happens" (Yes is very unlikely)
- fairValue = 0.50 means "coin flip"
- fairValue = 0.95 means "I think there's a 95% chance Yes happens" (Yes is near-certain)
- fairValue is NOT your confidence. It is NOT how sure you are in your call. It is your read on the PROBABILITY of the YES outcome.
- If your thesis says Yes is "unlikely" / "won't happen" / "low chance" → fairValue must be LOW (under 0.20).
- If your thesis says Yes is "very likely" / "near-certain" → fairValue must be HIGH (over 0.80).
- If your thesis is bearish on Yes, fairValue is low. ALWAYS.

CALIBRATION ETHOS — look for mispricing in BOTH directions:
You should be approximately as willing to call YES as you are to call NO. A board with 8 NO calls and 0 YES calls means you're systematically anchoring on "crowd is too optimistic". Both directions of mispricing exist on Polymarket every day. Find them.

WORKED EXAMPLES — follow this reasoning pattern. Note the mix.

Example A (PASS) — "Will Bitcoin hit $150k by June 30, 2026?" yesPrice = 0.014 (1.4¢)
- Assessment: BTC needs ~+150% in ~6 weeks. Base rate near zero. True prob ≈ 1%.
- fairValue = 0.01 → within 3¢ of crowd → pick = "Pass"
- thesis 1: "BTC needs >100% move in 6 weeks with no obvious catalyst; crowd's 1¢ matches a near-impossible event."
- thesis 2: "A clean break above $130k by mid-May with sustained volume would flip me to Yes."

Example B (BUY YES, crowd underprices a near-routine event) — "Will Trump say 'Iran' in his next speech?" yesPrice = 0.45
- Assessment: Iran is a recurring Trump talking point in any policy speech. True prob ≈ 0.70.
- fairValue = 0.70 → Edge = +25¢ on Yes → pick = "Yes"

Example C (BUY NO, crowd overprices a favorite) — "Will Sinner beat Medvedev?" yesPrice = 0.88
- Assessment: Tennis upsets at the top of best-of-3 happen ~15-20% of the time. True prob ≈ 0.80.
- fairValue = 0.80 → Edge = -8¢ on Yes → pick = "No"

Example D (BUY YES, crowd discounts a scheduled certainty) — "Will the FOMC release a statement on May 21?" yesPrice = 0.74
- Assessment: FOMC statements are released after every scheduled meeting; the only way this resolves No is the meeting itself being cancelled. True prob ≈ 0.97.
- fairValue = 0.97 → Edge = +23¢ on Yes → pick = "Yes"

Example E (PASS, multi-outcome trap) — "Will France win the 2026 FIFA World Cup?" yesPrice = 0.18
- Assessment: 32 teams competing. France is a strong contender, maybe ~15-20% true probability. There is no "long window underpriced" edge here — it's a one-of-N event.
- fairValue = 0.18 → Edge ≈ 0¢ → pick = "Pass"

FOR EACH MARKET, OUTPUT (in this order):
1. "reason": one short sentence (under 120 chars) on what's striking RIGHT NOW. Punchy, active, reference numbers. No emoji.
2. "category": exactly one of: ${CATEGORIES.join(", ")}.
3. "fairValue": the probability of YES resolving true (0.01–0.99). Compute BEFORE deciding your pick. Match it to your honest read.
4. "thesis": THREE sentences, under 420 chars total, separated by single spaces. Sentence 1: the analytical read on the question. Sentence 2: what the crowd's price implies and whether that's reasonable. Sentence 3: what would change your call.
5. "pick": derived from fairValue vs yesPrice — DO NOT contradict your fairValue:
   - fairValue > yesPrice + 0.03 → pick = "Yes"
   - fairValue < yesPrice − 0.03 → pick = "No"
   - otherwise → pick = "Pass"
6. "confidence": "low" / "medium" / "high".

TAKE A POSITION — Pass is the last resort. AND BALANCE BOTH SIDES.
Pass should be < 30% of cards. Your call distribution should not be lopsided. If you're finding 8 NO picks, look hard for the YES mispricings you might be missing — they exist on every board.

CROWD OVERPRICES (lean NO):
- Specific verbal triggers ("will X say 'word'") trading above 15¢.
- Narrow-window markets with no clear catalyst.
- Geopolitical "deal by date" markets.
- Asset price targets in short windows trading above 5¢.
- Sports favorites at 85-95¢ in single-match formats.

CROWD UNDERPRICES (lean YES) — ONLY when the structural argument is clear:
- Scheduled / recurring events with one specific actor trading below 80¢.
- Continuation of an ongoing observable trend below 50%.
- Single well-defined event with clear catalyst already in motion.

⚠ DO NOT LEAN YES ON THESE — they look underpriced but aren't:
- "Will X win the [tournament]" with many competing entrants.
- "Will [extreme geopolitical thing] happen" — low base rates trading low are correct.
- "Will [person] resign / be fired by [near date]".
- "Will [asset] hit [specific price level]".

CALIBRATION (confidence):
- "high": edge ≥ 10¢ AND a clear logical argument.
- "medium": edge 5–15¢ with a real argument.
- "low": edge under 5¢, or directional read without strong logic.

Also return "pulseTake": 1-2 sharp sentences on market #1 (only when wantPulseTake=true). Take a position. Name the side you favor and the price. Under 240 chars. No hedging, no emoji, no exclamation marks. When wantPulseTake=false, return an empty string.

Return JSON only. No markdown fences. No commentary outside the JSON.`;

export type DigestMarket = {
  id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  momentum: number;
  volume24hr: number;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pulseTake: { type: "string" },
    markets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          reason: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          fairValue: {
            type: "number",
            description:
              "Probability of YES resolving TRUE, between 0.01 and 0.99. Low if Yes is unlikely, high if Yes is likely.",
          },
          thesis: {
            type: "string",
            description:
              "Three sentences. (1) analytical read. (2) crowd interpretation. (3) what changes the call.",
          },
          pick: {
            type: "string",
            enum: PICKS,
            description:
              "Derived from fairValue vs yesPrice: 'Yes' if fairValue > yesPrice + 0.03, 'No' if fairValue < yesPrice − 0.03, else 'Pass'.",
          },
          confidence: { type: "string", enum: CONFIDENCES },
        },
        required: [
          "id",
          "reason",
          "category",
          "fairValue",
          "thesis",
          "pick",
          "confidence",
        ],
      },
    },
  },
  required: ["pulseTake", "markets"],
} as const;

function buildUserPrompt(markets: DigestMarket[]): string {
  const lines = markets.map((m, i) => {
    const yes = m.prices[0] ?? 0;
    const no = m.prices[1] ?? 0;
    const sign = m.momentum >= 0 ? "+" : "−";
    const delta = (Math.abs(m.momentum) * 100).toFixed(1);
    const volK =
      m.volume24hr >= 1_000_000
        ? `$${(m.volume24hr / 1_000_000).toFixed(2)}M`
        : `$${(m.volume24hr / 1_000).toFixed(1)}K`;
    return `${i + 1}. id=${m.id} | ${m.question}
   ${m.outcomes[0] ?? "Yes"} ${(yes * 100).toFixed(0)}¢ / ${m.outcomes[1] ?? "No"} ${(no * 100).toFixed(0)}¢ | momentum ${sign}${delta}¢ | 24h vol ${volK}`;
  });
  return `Top movers right now:\n\n${lines.join("\n\n")}`;
}

export type RunDigestOptions = {
  apiKey: string;
  includePulseTake?: boolean;
  /** Override OpenAI timeout in ms (default 60s) */
  timeoutMs?: number;
};

export type RunDigestResult =
  | { ok: true; digest: AIDigest }
  | { ok: false; error: string; status: number; detail?: string };

/**
 * Single OpenAI call producing predictions for a batch of markets.
 * Pure, server-only — no Next.js Response, no I/O beyond the network call.
 */
export async function runDigest(
  markets: DigestMarket[],
  opts: RunDigestOptions,
): Promise<RunDigestResult> {
  if (!opts.apiKey) {
    return { ok: false, error: "OPENAI_API_KEY missing", status: 503 };
  }
  if (markets.length === 0) {
    return { ok: false, error: "No markets provided", status: 400 };
  }

  const trimmed = markets.slice(0, 30);
  const wantPulseTake = opts.includePulseTake !== false;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 60_000,
  );

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: Math.min(6200, 600 + trimmed.length * 220),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              buildUserPrompt(trimmed) +
              (wantPulseTake
                ? ""
                : "\n\nIMPORTANT: skip the pulseTake for this batch — return an empty string for pulseTake."),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pulse_digest",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `OpenAI returned ${res.status}`,
        status: 502,
        detail: text.slice(0, 500),
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: true, digest: fallbackDigest(trimmed) };
    }
    if (!parsed || typeof parsed !== "object") {
      return { ok: true, digest: fallbackDigest(trimmed) };
    }

    const p = parsed as { pulseTake?: unknown; markets?: unknown };
    const pulseTake = wantPulseTake
      ? typeof p.pulseTake === "string"
        ? p.pulseTake
        : ""
      : "";
    const inputIds = new Set(trimmed.map((m) => m.id));
    const inputById = new Map(trimmed.map((m) => [m.id, m]));
    const cleaned: AIDigest["markets"] = [];

    if (Array.isArray(p.markets)) {
      for (const entry of p.markets) {
        if (!entry || typeof entry !== "object") continue;
        const obj = entry as Record<string, unknown>;
        const id = typeof obj.id === "string" ? obj.id : null;
        if (!id || !inputIds.has(id)) continue;

        const reason = typeof obj.reason === "string" ? obj.reason : "";
        const category = isCategory(obj.category) ? obj.category : "Other";
        let pick: AIPick = isPick(obj.pick) ? obj.pick : "Pass";
        let confidence: Confidence = isConfidence(obj.confidence)
          ? obj.confidence
          : "low";
        const thesis = typeof obj.thesis === "string" ? obj.thesis : "";

        let fairValue =
          typeof obj.fairValue === "number" ? obj.fairValue : 0.5;
        if (!Number.isFinite(fairValue)) fairValue = 0.5;
        fairValue = Math.max(0.01, Math.min(0.99, fairValue));

        // Safety net: enforce consistency between pick and fairValue.
        const inputMarket = inputById.get(id);
        if (inputMarket) {
          const yesPrice = inputMarket.prices[0] ?? 0.5;
          const diff = fairValue - yesPrice;
          let implied: AIPick;
          if (diff > 0.03) implied = "Yes";
          else if (diff < -0.03) implied = "No";
          else implied = "Pass";

          if (implied !== pick) {
            pick = implied;
            if (confidence === "high") confidence = "medium";
            else if (confidence === "medium") confidence = "low";
          }
        }

        cleaned.push({
          id,
          reason,
          category,
          pick,
          fairValue,
          confidence,
          thesis,
        });
      }
    }

    return {
      ok: true,
      digest: { pulseTake, markets: cleaned } satisfies AIDigest,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "OpenAI request timed out"
          : err.message
        : "Unknown error";
    return { ok: false, error: message, status: 500 };
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackDigest(markets: DigestMarket[]): AIDigest {
  return {
    pulseTake: "",
    markets: markets.map((m) => ({
      id: m.id,
      reason: "",
      category: "Other",
      pick: "Pass",
      fairValue: m.prices[0] ?? 0.5,
      confidence: "low",
      thesis: "",
    })),
  };
}
