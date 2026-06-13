import { NextRequest } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;

// simple in-memory cache (resets on server restart)
let cache: any = {
  items: [],
  nextPageToken: null,
  lastQuery: "",
};

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

      // 🔥 IMPORTANT: show real API error
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
  const isSameQuery = cache.lastQuery === query;

  // 🔥 return cache instantly for repeated searches
  if (isFirstPage && isSameQuery && cache.items.length > 0) {
    return Response.json(cache);
  }

  // 🔥 check API key early
  if (!API_KEY) {
    console.error("❌ Missing YOUTUBE_API_KEY in .env.local");
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

    // 🔥 only cache FIRST PAGE (prevents broken pagination)
    if (isFirstPage) {
      cache = {
        ...result,
        lastQuery: query,
      };
    }

    return Response.json(result);
  } catch (err) {
    console.log("API FAILED → returning cache:", err);

    return Response.json(cache);
  }
}