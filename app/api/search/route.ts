import { NextRequest } from "next/server";
import https from "https";

const API_KEY = process.env.YOUTUBE_API_KEY;

// ==========================
// SIMPLE CACHE
// ==========================
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 10;

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
// STABLE YOUTUBE FETCH (NO fetch/undici)
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
          const json = JSON.parse(data);

          // 🔥 DEBUG: show actual YouTube response
          console.log("YOUTUBE RESPONSE STATUS:", res.statusCode);
          console.log("YOUTUBE RESPONSE BODY:", json);

          resolve(json);
        } catch (err) {
          console.log("JSON PARSE ERROR:", data);
          reject(err);
        }
      });
    });

    req.on("error", (err) => {
      console.log("HTTPS ERROR:", err);
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

// ==========================
// ROUTE HANDLER
// ==========================
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const pageToken = req.nextUrl.searchParams.get("pageToken") || "";

  const cacheKey = `${query}-${pageToken}`;

  // cache hit
  const cached = getCache(cacheKey);
  if (cached) {
    return Response.json({ ...cached, cached: true });
  }

  if (!API_KEY) {
    return Response.json({
      items: [],
      error: "Missing YOUTUBE_API_KEY in .env.local",
    });
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=10` +
      `&q=${encodeURIComponent(query)}` +
      `&key=${API_KEY}` +
      (pageToken ? `&pageToken=${pageToken}` : "");

    const data = await fetchYouTube(url);

    // 🔥 IMPORTANT: log full API result
    console.log("FINAL YOUTUBE DATA:", data);

    if (!data.items) {
      return Response.json({
        items: [],
        error: data.error?.message || "No items returned from YouTube",
      });
    }

    const result = {
      items: data.items,
      nextPageToken: data.nextPageToken || null,
    };

    setCache(cacheKey, result);

    return Response.json(result);
  } catch (err: any) {
    console.log("YOUTUBE REQUEST FAILED:", err);

    // fallback cache search
    for (const [key, value] of cache.entries()) {
      if (key.startsWith(query)) {
        return Response.json({ ...value.data, stale: true });
      }
    }

    return Response.json({
      items: [],
      error: err?.message || "YouTube request failed",
    });
  }
}