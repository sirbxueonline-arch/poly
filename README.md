# Polymarket Pulse

A live, single-page Next.js dashboard that scans Polymarket for the highest-momentum prediction markets and lets a GPT-4o-mini analyst call BUY YES / BUY NO / PASS on each one with a fair-value estimate, edge, and three-sentence thesis.

- **Live polling** of `gamma-api.polymarket.com` for prices, momentum, volume
- **Server-side AI digest** (parallel-chunked OpenAI calls) runs every **5 minutes**
- **In-memory cache** holds the predictions for the lifetime of the Node process — no database
- **Stale-while-revalidate**: cache served immediately; if it's > 5 min old, a background refresh is kicked off for the next request

## Setup

### 1. Install

```bash
npm install
```

### 2. Set the OpenAI key

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| var | where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |

⚠ **Never commit `.env.local`.** It's gitignored. OpenAI auto-detects leaked keys in public commits and revokes them.

### 3. Run

```bash
npm run dev          # Turbopack (faster compile, more memory)
npm run dev:webpack  # Webpack (slower compile, much less memory — use if your machine is tight)
```

Open <http://localhost:3000>. The page renders **15 demo markets immediately** so it looks fully populated from the first frame; ~20-30 s later the first real AI digest lands and demo data is replaced with live Polymarket predictions.

## Architecture

```
Browser ──GET /api/markets────────▶ Polymarket gamma-api (proxied)
        ──GET /api/predictions────▶ in-memory cache (Map in Node process)
                                          │
                                          ▼ if cache > 5 min old
                                  background refresh job
                                          │
                                          ├─▶ Polymarket (fresh top 50)
                                          ├─▶ OpenAI gpt-4o-mini (10 parallel workers)
                                          └─▶ in-memory store (upsert predictions)
```

No external database. If the dev server restarts the cache is empty until the next refresh fires — which it will on the first request, so the impact is one ~15-second warmup, not data loss.

| Concern | Where |
|---|---|
| Score + filter markets | [`app/lib/score.ts`](app/lib/score.ts) |
| OpenAI prompt + structured-output schema | [`app/lib/openai-digest.ts`](app/lib/openai-digest.ts) |
| Refresh orchestrator (parallel fanout, lock, in-memory writes) | [`app/lib/refresh.ts`](app/lib/refresh.ts) |
| In-memory store (predictions + meta) | [`app/lib/db.ts`](app/lib/db.ts) |
| Demo markets shown on first paint | [`app/lib/demo-data.ts`](app/lib/demo-data.ts) |
| Cached-read API | [`app/api/predictions/route.ts`](app/api/predictions/route.ts) |
| Polymarket proxy | [`app/api/markets/route.ts`](app/api/markets/route.ts) |
| Client page (no AI calls from the browser) | [`app/page.tsx`](app/page.tsx) |

## Disclaimer

AI picks are GPT-4o-mini's opinion, not a forecast. Prediction markets are speculative. **Not financial advice.**
