"use client";

import { useEffect, useRef, useState } from "react";

type Video = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
  };
};

export default function Home() {
  const [query, setQuery] = useState("shorts");
  const [results, setResults] = useState<Video[]>([]);
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const seenVideos = useRef(new Set<string>());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function search(reset = true) {
    if (loading) return;

    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set("q", query);

      if (!reset && pageToken) {
        params.set("pageToken", pageToken);
      }

      const res = await fetch(`/api/search?${params.toString()}`);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      const incoming = (data.items || []).filter((video: Video) => {
        const id = video.id?.videoId;

        if (!id) return false;

        if (seenVideos.current.has(id)) return false;

        seenVideos.current.add(id);

        return true;
      });

      if (reset) {
        setResults(incoming);
      } else {
        setResults((prev) => [...prev, ...incoming]);
      }

      setPageToken(data.nextPageToken || null);
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error ? err.message : "Unknown search error"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    seenVideos.current.clear();
    setResults([]);
    setPageToken(null);

    search(true);
  }

  useEffect(() => {
    if (!autoRefresh) return;

    intervalRef.current = setInterval(() => {
      seenVideos.current.clear();
      search(true);
    }, 180000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, query]);

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Short Scope</h1>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Shorts..."
          style={{
            flex: 1,
            minWidth: 250,
            padding: 10,
          }}
        />

        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>

        <button
          onClick={() => setAutoRefresh((v) => !v)}
          style={{
            background: autoRefresh ? "green" : "#ddd",
            color: autoRefresh ? "white" : "black",
            border: "none",
            padding: "10px 14px",
            borderRadius: 8,
          }}
        >
          {autoRefresh ? "Auto On" : "Auto Off"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setView("list")}
          style={{
            padding: "8px 16px",
            background: view === "list" ? "#000" : "#eee",
            color: view === "list" ? "#fff" : "#000",
            border: "none",
            borderRadius: 8,
          }}
        >
          List
        </button>

        <button
          onClick={() => setView("grid")}
          style={{
            padding: "8px 16px",
            background: view === "grid" ? "#000" : "#eee",
            color: view === "grid" ? "#fff" : "#000",
            border: "none",
            borderRadius: 8,
          }}
        >
          Grid
        </button>
      </div>

      <p>Results: {results.length}</p>

      {view === "list" ? (
        <div>
          {results.map((video, index) => {
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
                  gap: 12,
                  padding: 10,
                  marginBottom: 10,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "black",
                }}
              >
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  width={120}
                  height={70}
                  alt=""
                />

                <div>
                  <div>{video.snippet?.title}</div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    {video.snippet?.channelTitle}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(180px,1fr))",
            gap: 12,
          }}
        >
          {results.map((video, index) => {
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
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "4/5",
                      objectFit: "cover",
                      borderRadius: 12,
                    }}
                  />
                </a>

                <div style={{ marginTop: 5 }}>
                  {video.snippet?.title}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  {video.snippet?.channelTitle}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pageToken && (
        <div
          style={{
            marginTop: 30,
            textAlign: "center",
          }}
        >
          <button
            disabled={loading}
            onClick={() => search(false)}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </main>
  );
}