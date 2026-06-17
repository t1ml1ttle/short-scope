"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState("shorts");
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");

  const [autoRefresh, setAutoRefresh] = useState(false);

  const searchLock = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const seenVideos = useRef(new Set<string>());

  // =========================
  // SEARCH FUNCTION (STABLE)
  // =========================
  async function search(reset = true) {
    if (loading || searchLock.current) return;

    searchLock.current = true;
    setLoading(true);

    try {
      const url =
        `/api/search?q=${encodeURIComponent(query)}` +
        (reset ? "" : `&pageToken=${pageToken || ""}`);

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Search failed");
      }

      const items = data.items || [];

      // remove duplicates
      const filtered = items.filter((video: any) => {
        const id = video.id?.videoId;
        if (!id) return false;
        if (seenVideos.current.has(id)) return false;

        seenVideos.current.add(id);
        return true;
      });

      setResults((prev) => (reset ? filtered : [...prev, ...filtered]));
      setPageToken(data.nextPageToken || null);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
      searchLock.current = false;
    }
  }

  // =========================
  // AUTO REFRESH (SAFE)
  // =========================
  useEffect(() => {
    if (!autoRefresh) return;

    intervalRef.current = setInterval(() => {
      search(true);
    }, 180000); // 3 min

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, query]);

  const handleNewSearch = () => {
    if (loading) return;

    setResults([]);
    setPageToken(null);
    seenVideos.current.clear();

    search(true);
  };

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1>Short Scope</h1>

      {/* SEARCH BAR */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Shorts..."
          style={{ padding: 10, flex: 1, maxWidth: 400 }}
        />

        <button onClick={handleNewSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>

        <button
          onClick={() => setAutoRefresh((p) => !p)}
          style={{
            padding: "8px 12px",
            background: autoRefresh ? "green" : "#eee",
            color: autoRefresh ? "white" : "black",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          {autoRefresh ? "Auto On" : "Auto Off"}
        </button>
      </div>

      {/* VIEW TOGGLE */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setView("list")}
          style={{
            background: view === "list" ? "#000" : "#eee",
            color: view === "list" ? "#fff" : "#000",
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          List
        </button>

        <button
          onClick={() => setView("grid")}
          style={{
            background: view === "grid" ? "#000" : "#eee",
            color: view === "grid" ? "#fff" : "#000",
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Grid
        </button>
      </div>

      <p style={{ opacity: 0.7 }}>Results: {results.length}</p>

      {/* RESULTS */}
      {view === "list" ? (
        <div>
          {results.map((video: any, index: number) => {
            const videoId = video.id?.videoId;
            if (!videoId) return null;

            return (
              <a
                key={`${videoId}-${index}`}
                href={`https://youtube.com/shorts/${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 12,
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "black",
                  alignItems: "center",
                }}
              >
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  width={120}
                  height={70}
                  style={{ borderRadius: 6, objectFit: "cover" }}
                />

                <div>
                  <h3 style={{ margin: 0, fontSize: 14 }}>
                    {video.snippet?.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                    {video.snippet?.channelTitle}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 5,
          }}
        >
          {results.map((video: any, index: number) => {
            const videoId = video.id?.videoId;
            if (!videoId) return null;

            return (
              <div key={`${videoId}-${index}`}>
                <a
                  href={`https://youtube.com/shorts/${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 5",
                      objectFit: "cover",
                      borderRadius: 12,
                    }}
                  />
                </a>

                <div style={{ fontSize: 14, marginTop: 5 }}>
                  {video.snippet?.title}
                </div>

                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {video.snippet?.channelTitle}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOAD MORE */}
      {pageToken && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
          <button
            onClick={() => search(false)}
            disabled={loading}
            style={{ padding: "12px 24px" }}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
      <footer style={{ marginTop: 40, fontSize: 12, opacity: 0.7 }}>
        <p>
          Short Scope uses YouTube Data API Services to search and display publicly available YouTube content.
        </p>

        <a href="/privacy" style={{ color: "#1a73e8" }}>
          Privacy Policy
        </a>
      </footer>
    </main>
  );
}

