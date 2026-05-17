export const dynamic = "force-dynamic";
export const revalidate = 0;

const POLYMARKET_URL =
  "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false";

export async function GET() {
  try {
    const res = await fetch(POLYMARKET_URL, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "polymarket-pulse/1.0",
      },
    });

    if (!res.ok) {
      return Response.json(
        { error: `Upstream returned ${res.status}` },
        {
          status: 502,
          headers: { "cache-control": "no-store, max-age=0" },
        },
      );
    }

    const data = await res.json();

    return Response.json(data, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    return Response.json(
      { error: message },
      {
        status: 500,
        headers: { "cache-control": "no-store, max-age=0" },
      },
    );
  }
}
