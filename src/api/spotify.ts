const BASE = 'https://api.spotify.com/v1';

async function spotifyFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${path} → ${res.status}`);
  return res.json();
}

export async function getMe(token: string) {
  return spotifyFetch('/me', token);
}

export async function getFeaturedPlaylists(token: string, limit = 10) {
  return spotifyFetch(`/browse/featured-playlists?limit=${limit}`, token);
}

export async function getNewReleases(token: string, limit = 10) {
  return spotifyFetch(`/browse/new-releases?limit=${limit}`, token);
}

export async function getUserPlaylists(token: string, limit = 50) {
  return spotifyFetch(`/me/playlists?limit=${limit}`, token);
}

export async function getUserLikedTracks(token: string, limit = 50) {
  return spotifyFetch(`/me/tracks?limit=${limit}`, token);
}

export async function getUserTopTracks(token: string, limit = 20) {
  return spotifyFetch(`/me/top/tracks?limit=${limit}&time_range=short_term`, token);
}

export async function searchSpotify(query: string, token: string, types = 'track,artist,album', limit = 20) {
  return spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=${types}&limit=${limit}`,
    token,
  );
}

export async function getRecommendations(token: string, seedTracks: string[], limit = 20) {
  const seeds = seedTracks.slice(0, 5).join(',');
  return spotifyFetch(`/recommendations?seed_tracks=${seeds}&limit=${limit}`, token);
}
