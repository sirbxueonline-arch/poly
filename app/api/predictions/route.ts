import { isConfigured, readAllPredictions } from "@/app/lib/db";
import {
  REFRESH_INTERVAL_MS,
  forceRefresh,
  getRefreshState,
  maybeKickOffRefresh,
} from "@/app/lib/refresh";

export const dynamic = "force-dynamic";

/**
 * Returns the cached AI predictions from Supabase. If the cache is older than
 * 5 minutes, kicks off a background refresh — the *next* request will pick up
 * the new data. This request always returns immediately.
 */
export async function GET() {
  if (!isConfigured()) {
    return Response.json(
      {
        predictions: [],
        pulseTake: null,
        refreshing: false,
        activeWorkers: 0,
        lastDigestAt: null,
        nextDigestAt: null,
        ageMs: null,
        msUntilNext: 0,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
        kickedOffRefresh: false,
        notConfigured: true,
        configurationHelp:
          "Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to .env.local, run supabase/schema.sql in the SQL editor, then restart the dev server.",
      },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  }

  const triggered = maybeKickOffRefresh();
  const [predictions, state] = await Promise.all([
    readAllPredictions(),
    getRefreshState(),
  ]);
  const now = Date.now();
  const ageMs = state.lastDigestAt > 0 ? now - state.lastDigestAt : null;
  const msUntilNext =
    state.lastDigestAt > 0 ? Math.max(0, state.nextDigestAt - now) : 0;

  return Response.json(
    {
      predictions,
      pulseTake: state.pulseTake ?? null,
      refreshing: state.refreshing,
      activeWorkers: state.activeWorkers,
      lastDigestAt: state.lastDigestAt || null,
      nextDigestAt: state.nextDigestAt || null,
      ageMs,
      msUntilNext,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      kickedOffRefresh: triggered,
    },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}

/**
 * Manual refresh trigger. Doesn't bypass the in-flight lock — if a refresh
 * is already running, returns immediately with the current state.
 */
export async function POST() {
  await forceRefresh();
  return Response.json({ ok: true, state: await getRefreshState() });
}
