export const dynamic = "force-dynamic";

type ExplainInput = {
  id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  momentum: number;
  volume24hr: number;
  liquidity: number;
  endDate?: string | null;
};

const MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are an analyst for Polymarket Pulse, a live prediction-market scanner.

Given a single market's current snapshot, write a 2-3 sentence plainspoken analysis:
- Sentence 1: what the price says traders believe right now.
- Sentence 2: the momentum signal — what just changed, in cents and direction.
- Optional sentence 3: one thing to watch (volume level, time to close, asymmetric pricing).

Rules: under 320 chars total. No hedging. No "could" / "might" / "may". No emoji. No exclamation marks. No markdown. Active voice. Reference the actual numbers.`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: ExplainInput;
  try {
    body = (await req.json()) as ExplainInput;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.id || !body.question) {
    return Response.json({ error: "Missing market data" }, { status: 400 });
  }

  const yes = body.prices[0] ?? 0;
  const no = body.prices[1] ?? 0;
  const sign = body.momentum >= 0 ? "+" : "−";
  const delta = (Math.abs(body.momentum) * 100).toFixed(1);
  const volStr =
    body.volume24hr >= 1_000_000
      ? `$${(body.volume24hr / 1_000_000).toFixed(2)}M`
      : `$${(body.volume24hr / 1_000).toFixed(1)}K`;
  const liqStr =
    body.liquidity >= 1_000_000
      ? `$${(body.liquidity / 1_000_000).toFixed(2)}M`
      : `$${(body.liquidity / 1_000).toFixed(1)}K`;
  const endStr = body.endDate ? ` Closes ${body.endDate}.` : "";

  const userPrompt = `Market: ${body.question}
${body.outcomes[0] ?? "Yes"} ${(yes * 100).toFixed(0)}¢ / ${body.outcomes[1] ?? "No"} ${(no * 100).toFixed(0)}¢
Momentum this tick: ${sign}${delta}¢
24h volume: ${volStr}
Liquidity: ${liqStr}.${endStr}`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 220,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `OpenAI returned ${res.status}`, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const explanation =
      data.choices?.[0]?.message?.content?.trim() ?? "";

    return Response.json({ id: body.id, explanation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
