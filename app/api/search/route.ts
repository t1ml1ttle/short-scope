import { NextRequest } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;

// ===============================
// 🧠 SMART CACHE STORE
// ===============================
type CacheEntry = {
  items: any[];
  nextPageToken: string | null;
  timestamp: number;
};

const cache: Map<string, CacheEntry> = new Map();

// cache freshness (90 seconds = “feels live” but quota safe)
const CACHE_TTL = 90 * 1000;

// simple retry helper
async function fetchWithRetry(url: string, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

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

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") || "";

  const isFirstPage = !pageToken;

  // only cache FIRST PAGE (important for correctness)
  const cacheKey = query;

  // ===============================
  // 🧠 CACHE HIT LOGIC
  // ===============================
  if (isFirstPage) {
    const cached = cache.get(cacheKey);

    if (cached) {
      const isFresh = Date.now() - cached.timestamp < CACHE_TTL;

      if (isFresh) {
        console.log("🟢 CACHE HIT:", query);
        return Response.json({
          items: cached.items,
          nextPageToken: cached.nextPageToken,
          cached: true,
        });
      }

      console.log("🟡 CACHE STALE → refreshing:", query);
    }
  }

  // ===============================
  // 🔑 API KEY CHECK
  // ===============================
  if (!API_KEY) {
    return Response.json({
      items: [],
      nextPageToken: null,
      error: "Missing API key",
    });
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&order=date` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : "");

    const data = await fetchWithRetry(url, 2);

    const result = {
      items: data.items || [],
      nextPageToken: data.nextPageToken || null,
    };

    // ===============================
    // 🧠 UPDATE CACHE (FIRST PAGE ONLY)
    // ===============================
    if (isFirstPage) {
      cache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });
    }

    return Response.json(result);
  } catch (err) {
    console.log("API FAILED → serving cache fallback");

    const fallback = cache.get(cacheKey);

    return Response.json(
      fallback || {
        items: [],
        nextPageToken: null,
        error: "API failed and no cache available",
      }
    );
  }
}