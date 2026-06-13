"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState("shorts");
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");

  async function search(reset = true) {
    if (loading) return;

    setLoading(true);

    try {
      const url =
        `/api/search?q=${encodeURIComponent(query)}` +
        (reset ? "" : `&pageToken=${pageToken || ""}`);

      const res = await fetch(url);
      const data = await res.json();

      console.log("Items:", data.items?.length);
      console.log("Next Page Token:", data.nextPageToken);

      setResults((prev) =>
        reset ? data.items || [] : [...prev, ...(data.items || [])]
      );

      setPageToken(data.nextPageToken || null);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search(true);
  }, []);

  const handleNewSearch = () => {
    setResults([]);
    setPageToken(null);
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
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Shorts..."
          style={{
            padding: 10,
            flex: 1,
            maxWidth: 400,
          }}
        />

        <button onClick={handleNewSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
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
          List View
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
          Grid View
        </button>
      </div>

      {/* RESULTS COUNT */}
      <p style={{ opacity: 0.7 }}>Results: {results.length}</p>

      {/* RESULTS */}
      {view === "list" ? (
        <div style={{ marginTop: 20 }}>
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
            marginTop: 20,
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

                <a
                  href={`https://youtube.com/shorts/${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    marginTop: 8,
                    textDecoration: "none",
                    color: "#000",
                    fontWeight: 500,
                    fontSize: 14,
                  }}
                >
                  {video.snippet?.title}
                </a>

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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 30,
          }}
        >
          <button
            onClick={() => search(false)}
            disabled={loading}
            style={{
              padding: "12px 24px",
              fontSize: 16,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!pageToken && results.length > 0 && (
        <p style={{ textAlign: "center", marginTop: 30, opacity: 0.6 }}>
          No more results available.
        </p>
      )}
    </main>
  );
}