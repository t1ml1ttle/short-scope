import { NextRequest } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;

// =====================
// CONFIG
// =====================
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
const cache: Record<
  string,
  { data: any; timestamp: number }
> = {};

// =====================
// FETCH WITH RETRY
// =====================
async function fetchWithRetry(url: string, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        console.log("YouTube API ERROR:", res.status, text);
        throw new Error(`Bad response: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
    }
  }
}

// =====================
// ROUTE HANDLER
// =====================
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() || "";
  const pageToken =
    req.nextUrl.searchParams.get("pageToken") || "";

  const cacheKey = `${query}_${pageToken}`;
  const cached = cache[cacheKey];

  // =====================
  // RETURN CACHE IF VALID
  // =====================
  if (
    cached &&
    Date.now() - cached.timestamp < CACHE_TTL
  ) {
    return Response.json(cached.data);
  }

  if (!API_KEY) {
    console.error("❌ Missing YOUTUBE_API_KEY");
    return Response.json({
      items: [],
      nextPageToken: null,
      error: "Missing API key",
    });
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet&type=video&maxResults=10&order=date` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : "");

    const data = await fetchWithRetry(url, 2);

    const result = {
      items: data.items || [],
      nextPageToken: data.nextPageToken || null,
    };

    // =====================
    // STORE IN CACHE
    // =====================
    cache[cacheKey] = {
      data: result,
      timestamp: Date.now(),
    };

    return Response.json(result);
  } catch (err) {
    console.log("API FAILED → fallback error:", err);

    return Response.json({
      items: [],
      nextPageToken: null,
      error: "Failed to fetch results",
    });
  }
}