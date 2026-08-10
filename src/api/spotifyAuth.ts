export const SPOTIFY_CLIENT_ID = '6b6e7f5e95874cbeb6d0c42d33b1382f';

export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-top-read',
  'user-read-recently-played',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-follow-read',
  'user-follow-modify',
];

// Static discovery — avoids an extra network round-trip on every auth attempt
export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export interface SpotifyTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenData> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  return res.json();
}
