import { NextRequest } from "next/server";
import https from "https";

const API_KEY = process.env.YOUTUBE_API_KEY;

// ==========================
// SIMPLE IN-MEMORY CACHE
// ==========================
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 10; // 10 min

function getCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
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
// STABLE YOUTUBE FETCH (NO UNDICI)
// ==========================
function fetchYouTube(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);

    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

// ==========================
// ROUTE
// ==========================
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") || "";

  const cacheKey = `${query}-${pageToken}`;

  // 1. cache hit
  const cached = getCache(cacheKey);
  if (cached) {
    return Response.json({ ...cached, cached: true });
  }

  if (!API_KEY) {
    return Response.json({ items: [], error: "Missing API key" });
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

    setCache(cacheKey, result);

    return Response.json(result);
  } catch (err) {
    console.log("API FAILED → serving fallback");

    // fallback cache search
    for (const [key, value] of cache.entries()) {
      if (key.startsWith(query)) {
        return Response.json({ ...value.data, stale: true });
      }
    }

    return Response.json({
      items: [],
      error: "No data available",
    });
  }
}