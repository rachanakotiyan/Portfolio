export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const username = process.env.LASTFM_USERNAME;
  if (!apiKey || !username) {
    return response.status(503).json({ error: "Now playing is not configured" });
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.search = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: "1"
  });

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return response.status(502).json({ error: "Music service request failed" });
  }

  const payload = await upstream.json();
  const track = payload.recenttracks?.track?.[0];
  if (!track) return response.status(200).json({ track: null });

  return response.status(200).json({
    track: track.name,
    artist: track.artist?.["#text"] ?? "Unknown artist",
    nowPlaying: track["@attr"]?.nowplaying === "true"
  });
}
