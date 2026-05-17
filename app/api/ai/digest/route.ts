import { runDigest, type DigestMarket } from "@/app/lib/openai-digest";

export const dynamic = "force-dynamic";

type DigestRequest = {
  markets: DigestMarket[];
  includePulseTake?: boolean;
};

/**
 * Thin HTTP wrapper around the shared `runDigest` lib.
 *
 * The page used to hit this endpoint directly from the browser with N parallel
 * calls. Now the server-side `/api/predictions` route is the canonical caller
 * (via `lib/refresh.ts`). This route is kept for ad-hoc / debugging use.
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: DigestRequest;
  try {
    body = (await req.json()) as DigestRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.markets?.length) {
    return Response.json({ error: "No markets provided" }, { status: 400 });
  }

  const result = await runDigest(body.markets, {
    apiKey,
    includePulseTake: body.includePulseTake !== false,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return Response.json(result.digest);
}
