import { NextRequest } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;

// ==========================
// SMART MEMORY CACHE
// ==========================
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

function getCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ==========================
// SAFE FETCH (NO SPAM RETRIES)
// ==========================
async function fetchYouTube(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.log("YouTube API ERROR:", res.status, text);
    throw new Error(`YouTube API failed: ${res.status}`);
  }

  return res.json();
}

// ==========================
// ROUTE HANDLER
// ==========================
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") || "";

  const cacheKey = `${query}-${pageToken}`;

  // 1. CHECK CACHE FIRST (THIS SAVES YOUR QUOTA)
  const cached = getCache(cacheKey);
  if (cached) {
    return Response.json({
      ...cached,
      cached: true,
    });
  }

  if (!API_KEY) {
    return Response.json({
      items: [],
      error: "Missing API key",
    });
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=10` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : "");

    const data = await fetchYouTube(url);

    const result = {
      items: data.items || [],
      nextPageToken: data.nextPageToken || null,
    };

    // 2. SAVE TO CACHE
    setCache(cacheKey, result);

    return Response.json(result);
  } catch (err) {
    console.log("API FAILED → serving stale cache fallback");

    // 3. FALLBACK: try ANY cached version of query (even older page)
    for (const [key, value] of cache.entries()) {
      if (key.startsWith(query)) {
        return Response.json({
          ...value.data,
          stale: true,
        });
      }
    }

    return Response.json({
      items: [],
      nextPageToken: null,
      error: "No cached data available",
    });
  }
}