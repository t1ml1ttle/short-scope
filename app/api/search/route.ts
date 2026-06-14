import { NextRequest } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;

type CacheEntry = {
  data: {
    items: any[];
    nextPageToken: string | null;
  };
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

function getCache(key: string) {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: CacheEntry["data"]) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

async function fetchYouTube(url: string) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();

      console.error("========== YOUTUBE API ERROR ==========");
      console.error("Status:", res.status);
      console.error("Response:", text);
      console.error("=======================================");

      throw new Error(`YouTube API failed (${res.status})`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() || "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") || "";

  if (!query) {
    return Response.json({
      items: [],
      nextPageToken: null,
      error: "Missing query",
    });
  }

  if (!API_KEY) {
    console.error("YOUTUBE_API_KEY missing");

    return Response.json(
      {
        items: [],
        nextPageToken: null,
        error: "Missing YOUTUBE_API_KEY",
      },
      { status: 500 }
    );
  }

  const cacheKey = `${query}-${pageToken}`;

  const cached = getCache(cacheKey);

  if (cached) {
    return Response.json({
      ...cached,
      cached: true,
    });
  }

  try {
    const url =
      "https://www.googleapis.com/youtube/v3/search?" +
      new URLSearchParams({
        part: "snippet",
        type: "video",
        order: "date",
        maxResults: "25",
        q: query,
        key: API_KEY,
        ...(pageToken ? { pageToken } : {}),
      });

    console.time(`youtube:${query}`);

    const data = await fetchYouTube(url);

    console.timeEnd(`youtube:${query}`);

    const result = {
      items: data.items || [],
      nextPageToken: data.nextPageToken || null,
    };

    setCache(cacheKey, result);

    return Response.json(result);
  } catch (error: any) {
    console.error("SEARCH ROUTE ERROR");
    console.error(error);

    const stale = cache.get(cacheKey);

    if (stale) {
      return Response.json({
        ...stale.data,
        stale: true,
      });
    }

    return Response.json(
      {
        items: [],
        nextPageToken: null,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}