# Polymarket Pulse

A live, single-page Next.js dashboard that scans Polymarket for the highest-momentum prediction markets and lets a GPT-4o-mini analyst call BUY YES / BUY NO / PASS on each one with a fair-value estimate, edge, and three-sentence thesis.

- **Live polling** of `gamma-api.polymarket.com` for prices, momentum, volume
- **Server-side AI digest** (parallel-chunked OpenAI calls) runs every **5 minutes**
- **Supabase Postgres** caches the predictions so reloads are instant — no AI re-runs per visitor
- **Stale-while-revalidate**: cache served immediately; if it's > 5 min old, a background refresh is kicked off for the next request

## Setup

### 1. Install

```bash
npm install
```

### 2. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and paste the contents of [`supabase/schema.sql`](supabase/schema.sql). Run it. Creates `predictions` + `meta` tables with RLS.

### 3. Set env vars

Copy the template and fill in real values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| var | where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret |

⚠ **Never commit `.env.local`.** It's gitignored. The service-role key bypasses Supabase row-level security; treat it like a password.

### 4. Run

```bash
npm run dev          # Turbopack (faster compile, more memory)
npm run dev:webpack  # Webpack (slower compile, much less memory — use if your machine is tight)
```

Open <http://localhost:3000>. On first load you'll see all 50 cards with skeleton verdicts; ~20-30 s later the first AI digest lands and predictions fill in.

## Architecture

```
Browser ──GET /api/markets────────▶ Polymarket gamma-api (proxied)
        ──GET /api/predictions────▶ Supabase (cached predictions)
                                          │
                                          ▼ if cache > 5 min old
                                  background refresh job
                                          │
                                          ├─▶ Polymarket (fresh top 50)
                                          ├─▶ OpenAI gpt-4o-mini (10 parallel workers)
                                          └─▶ Supabase (upsert predictions)
```

| Concern | Where |
|---|---|
| Score + filter markets | [`app/lib/score.ts`](app/lib/score.ts) |
| OpenAI prompt + structured-output schema | [`app/lib/openai-digest.ts`](app/lib/openai-digest.ts) |
| Refresh orchestrator (parallel fanout, lock, DB writes) | [`app/lib/refresh.ts`](app/lib/refresh.ts) |
| Supabase client + CRUD | [`app/lib/db.ts`](app/lib/db.ts) |
| Cached-read API | [`app/api/predictions/route.ts`](app/api/predictions/route.ts) |
| Polymarket proxy | [`app/api/markets/route.ts`](app/api/markets/route.ts) |
| Client page (no AI calls from the browser) | [`app/page.tsx`](app/page.tsx) |

## Disclaimer

AI picks are GPT-4o-mini's opinion, not a forecast. Prediction markets are speculative. **Not financial advice.**
