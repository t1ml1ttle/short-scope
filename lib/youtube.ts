const API_KEY = process.env.YOUTUBE_API_KEY;

export async function searchYouTubeShorts(query: string) {
  if (!API_KEY) throw new Error("Missing API key");

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=15` +
    `&order=date&q=${encodeURIComponent(query)}` +
    `&key=${API_KEY}`;

  const searchRes = await fetch(searchUrl).catch(() => null);
  if (!searchRes || !searchRes.ok) return [];

  const searchData = await searchRes.json().catch(() => null);
  if (!searchData?.items) return [];

  const ids = searchData.items
    .map((v: any) => v.id.videoId)
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const detailsUrl =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet,contentDetails,statistics&id=${ids}` +
    `&key=${API_KEY}`;

  const detailsRes = await fetch(detailsUrl).catch(() => null);
  if (!detailsRes || !detailsRes.ok) return [];

  const detailsData = await detailsRes.json().catch(() => null);
  if (!detailsData?.items) return [];

  return detailsData.items.filter((video: any) => {
    const duration = video.contentDetails.duration;
    const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);

    const minutes = Number(match?.[1] || 0);
    const seconds = Number(match?.[2] || 0);

    return minutes === 0 && seconds <= 60;
  });
}