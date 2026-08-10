import { Track } from '../types';

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
  const text = await res.text();
  if (!text) return null;
  // Some endpoints (play/pause/seek) return 200 with a non-JSON or blank-ish
  // body instead of the expected 204 — don't crash the whole call on that.
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function mapSpotifyTrack(raw: any): Track {
  return {
    id: raw.id,
    title: raw.name ?? 'Untitled',
    artist: (raw.artists ?? []).map((a: any) => a.name).join(', ') || 'Unknown Artist',
    artistId: raw.artists?.[0]?.id ?? '',
    duration: Math.round((raw.duration_ms ?? 0) / 1000),
    artworkUrl: raw.album?.images?.[0]?.url ?? null,
    streamUrl: '',
    genre: null,
    playCount: 0,
    source: 'spotify',
    spotifyUri: raw.uri,
    albumId: raw.album?.id,
  };
}

export async function getMe(token: string) {
  return spotifyFetch('/me', token);
}

// Note: /browse/featured-playlists, /browse/new-releases, and /browse/categories
// were fully removed for Development Mode apps in Spotify's February 2026 API
// changes — there is no replacement. Do not add them back; see README section 7.

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

function mapSpotifyPlaylist(raw: any): SpotifyPlaylist {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled playlist',
    imageUrl: raw.images?.[0]?.url ?? null,
    // Feb 2026: a playlist object's `tracks` field (including this summary
    // count) was renamed to `items` — same rename as getPlaylistTracks below,
    // just missed here originally. See README section 8.
    trackCount: raw.items?.total ?? raw.tracks?.total ?? 0,
  };
}

export async function getUserPlaylists(token: string, limit = 20): Promise<SpotifyPlaylist[]> {
  const json = await spotifyFetch(`/me/playlists?limit=${limit}`, token);
  return (json?.items ?? []).map(mapSpotifyPlaylist);
}

// Playlist management (list/create/get tracks) is confirmed still working for
// Development Mode apps as of Feb 2026 — unlike /browse and /me/tracks above.

export async function createPlaylist(token: string, name: string): Promise<SpotifyPlaylist> {
  const json = await spotifyFetch('/me/playlists', token, {
    method: 'POST',
    body: JSON.stringify({ name, public: false }),
  });
  return mapSpotifyPlaylist(json);
}

// Confirmed alive (not in any removed list) — editing a playlist's own details.
export async function updatePlaylistDetails(
  token: string,
  playlistId: string,
  details: { name?: string; description?: string },
) {
  return spotifyFetch(`/playlists/${playlistId}`, token, {
    method: 'PUT',
    body: JSON.stringify(details),
  });
}

// Feb 2026: GET /playlists/{id}/tracks was renamed to GET /playlists/{id}/items,
// and the per-item field renamed from `.track` to `.item` — see README section 8.
export async function getPlaylistTracks(token: string, playlistId: string, limit = 50): Promise<Track[]> {
  const json = await spotifyFetch(`/playlists/${playlistId}/items?limit=${limit}`, token);
  return (json?.items ?? [])
    .map((item: any) => item.item)
    .filter((t: any) => t && t.id)
    .map(mapSpotifyTrack);
}

// Confirmed via Spotify's own reference docs: path + body shape both verified.
export async function addTrackToPlaylist(token: string, playlistId: string, uri: string) {
  return spotifyFetch(`/playlists/${playlistId}/items`, token, {
    method: 'POST',
    body: JSON.stringify({ uris: [uri] }),
  });
}

// Path/body based on Spotify's Feb 2026 migration guide ("parameter `tracks`
// renamed to `items`", same [{uri}] object-array shape as before the rename) —
// this one specifically was not independently re-verified in a second source
// due to a network error while building it. Test carefully before relying on it.
export async function removeTrackFromPlaylist(token: string, playlistId: string, uri: string) {
  return spotifyFetch(`/playlists/${playlistId}/items`, token, {
    method: 'DELETE',
    body: JSON.stringify({ items: [{ uri }] }),
  });
}

// ── Artist / Album ─────────────────────────────────────────────────────────
// Single-resource GET /artists/{id} and /albums/{id} are confirmed still
// available (only the *batch* multi-id versions and /artists/{id}/top-tracks
// were removed in Feb 2026 — see README section 8). There's no direct
// replacement for top-tracks, so artist "Popular" uses a search workaround.

export interface SpotifyArtist {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number;
}

function mapSpotifyArtist(raw: any): SpotifyArtist {
  return {
    id: raw.id,
    name: raw.name ?? 'Unknown Artist',
    imageUrl: raw.images?.[0]?.url ?? null,
    genres: raw.genres ?? [],
    followers: raw.followers?.total ?? 0,
  };
}

export async function getArtist(token: string, artistId: string): Promise<SpotifyArtist> {
  const json = await spotifyFetch(`/artists/${artistId}`, token);
  return mapSpotifyArtist(json);
}

// Fixed after an audit caught this calling dead endpoints: PUT/DELETE
// /me/following and GET /me/following/contains were all removed in Feb 2026,
// consolidated into the same generic /me/library endpoints Liked Songs uses
// (see README section 9) — following is now just "saving" an artist URI.
export async function isFollowingArtist(token: string, artistId: string): Promise<boolean> {
  return isInLibrary(token, `spotify:artist:${artistId}`);
}

export async function followArtist(token: string, artistId: string) {
  return saveToLibrary(token, [`spotify:artist:${artistId}`]);
}

export async function unfollowArtist(token: string, artistId: string) {
  return removeFromLibrary(token, [`spotify:artist:${artistId}`]);
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  imageUrl: string | null;
  artist: string;
  releaseDate: string | null;
  totalTracks: number;
}

function mapSpotifyAlbum(raw: any): SpotifyAlbum {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled album',
    imageUrl: raw.images?.[0]?.url ?? null,
    artist: (raw.artists ?? []).map((a: any) => a.name).join(', ') || 'Unknown Artist',
    releaseDate: raw.release_date ?? null,
    totalTracks: raw.total_tracks ?? 0,
  };
}

export async function getArtistAlbums(token: string, artistId: string, limit = 10): Promise<SpotifyAlbum[]> {
  const json = await spotifyFetch(`/artists/${artistId}/albums?limit=${limit}&include_groups=album,single`, token);
  return (json?.items ?? []).map(mapSpotifyAlbum);
}

// No working "artist top tracks" endpoint anymore — search stands in for it.
export async function getArtistPopularTracks(token: string, artistName: string, limit = 10): Promise<Track[]> {
  return searchSpotifyTracks(`artist:"${artistName}"`, token, limit);
}

export async function getAlbum(token: string, albumId: string): Promise<{ album: SpotifyAlbum; tracks: Track[] }> {
  const json = await spotifyFetch(`/albums/${albumId}`, token);
  const album = mapSpotifyAlbum(json);
  const tracks: Track[] = (json?.tracks?.items ?? [])
    .filter((t: any) => t && t.id)
    .map((t: any) => {
      const mapped = mapSpotifyTrack(t);
      // Simplified track objects from an album don't carry the album's own
      // artwork or id — patch both in from the parent album we already have.
      return { ...mapped, artworkUrl: mapped.artworkUrl ?? album.imageUrl, albumId: album.id };
    });
  return { album, tracks };
}

// ── Podcasts ─────────────────────────────────────────────────────────────
// Confirmed working: single-resource GET /shows/{id}, GET /episodes/{id},
// GET /me/shows, and GET /shows/{id}/episodes all survived Feb 2026 — only
// the batch multi-id GET /shows and GET /episodes were removed, same pattern
// as tracks/artists/albums. See README section 8/11.

export interface SpotifyShow {
  id: string;
  name: string;
  publisher: string;
  imageUrl: string | null;
  description: string;
  totalEpisodes: number;
}

function mapSpotifyShow(raw: any): SpotifyShow {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled show',
    publisher: raw.publisher ?? 'Unknown publisher',
    imageUrl: raw.images?.[0]?.url ?? null,
    description: raw.description ?? '',
    totalEpisodes: raw.total_episodes ?? 0,
  };
}

export async function getShow(token: string, showId: string): Promise<SpotifyShow> {
  const json = await spotifyFetch(`/shows/${showId}`, token);
  return mapSpotifyShow(json);
}

export async function getUserSavedShows(token: string, limit = 20): Promise<SpotifyShow[]> {
  const json = await spotifyFetch(`/me/shows?limit=${limit}`, token);
  return (json?.items ?? []).map((item: any) => mapSpotifyShow(item.show ?? item));
}

// Episodes are mapped onto the same Track shape as songs — a spotify:episode:
// URI plays through Connect exactly like a spotify:track: one does, so this
// lets every existing playback/queue/UI path (playSpotifyTrack, TrackItem,
// Now Playing, the action sheet) work for podcasts with no new player code.
function mapSpotifyEpisode(raw: any, showName: string): Track {
  return {
    id: raw.id,
    title: raw.name ?? 'Untitled episode',
    artist: showName,
    artistId: '',
    duration: Math.round((raw.duration_ms ?? 0) / 1000),
    artworkUrl: raw.images?.[0]?.url ?? null,
    streamUrl: '',
    genre: null,
    playCount: 0,
    source: 'spotify',
    spotifyUri: raw.uri,
  };
}

export async function getShowEpisodes(token: string, showId: string, showName: string, limit = 50): Promise<Track[]> {
  const json = await spotifyFetch(`/shows/${showId}/episodes?limit=${limit}`, token);
  return (json?.items ?? [])
    .filter((e: any) => e && e.id)
    .map((e: any) => mapSpotifyEpisode(e, showName));
}

// ── Audiobooks ───────────────────────────────────────────────────────────
// Confirmed: GET /audiobooks/{id}, GET /me/audiobooks, and GET /audiobooks/{id}/chapters
// (single-resource) all survived Feb 2026 — only batch GET /chapters was removed.

export interface SpotifyAudiobook {
  id: string;
  name: string;
  author: string;
  imageUrl: string | null;
  description: string;
  totalChapters: number;
}

function mapSpotifyAudiobook(raw: any): SpotifyAudiobook {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled audiobook',
    author: (raw.authors ?? []).map((a: any) => a.name).join(', ') || 'Unknown author',
    imageUrl: raw.images?.[0]?.url ?? null,
    description: raw.description ?? '',
    totalChapters: raw.total_chapters ?? 0,
  };
}

export async function getAudiobook(token: string, audiobookId: string): Promise<SpotifyAudiobook> {
  const json = await spotifyFetch(`/audiobooks/${audiobookId}`, token);
  return mapSpotifyAudiobook(json);
}

export async function getUserSavedAudiobooks(token: string, limit = 20): Promise<SpotifyAudiobook[]> {
  const json = await spotifyFetch(`/me/audiobooks?limit=${limit}`, token);
  return (json?.items ?? []).map(mapSpotifyAudiobook);
}

// Chapters mapped onto the Track shape too, same reasoning as episodes — the
// URI Spotify gives back plays through Connect like anything else, no need
// to know or guess its exact prefix.
function mapSpotifyChapter(raw: any, audiobookName: string): Track {
  return {
    id: raw.id,
    title: raw.name ?? 'Untitled chapter',
    artist: audiobookName,
    artistId: '',
    duration: Math.round((raw.duration_ms ?? 0) / 1000),
    artworkUrl: raw.images?.[0]?.url ?? null,
    streamUrl: '',
    genre: null,
    playCount: 0,
    source: 'spotify',
    spotifyUri: raw.uri,
  };
}

export async function getAudiobookChapters(token: string, audiobookId: string, audiobookName: string, limit = 50): Promise<Track[]> {
  const json = await spotifyFetch(`/audiobooks/${audiobookId}/chapters?limit=${limit}`, token);
  return (json?.items ?? [])
    .filter((c: any) => c && c.id)
    .map((c: any) => mapSpotifyChapter(c, audiobookName));
}

export async function getUserTopTracks(token: string, limit = 10): Promise<Track[]> {
  const json = await spotifyFetch(`/me/top/tracks?limit=${limit}&time_range=short_term`, token);
  return (json?.items ?? []).map(mapSpotifyTrack);
}

// Development Mode caps `limit` at 10 as of Feb 2026 (used to be 50) — use `offset` to paginate.
export async function searchSpotify(query: string, token: string, types = 'track,artist,album', limit = 10) {
  return spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=${types}&limit=${Math.min(limit, 10)}`,
    token,
  );
}

export async function searchSpotifyTracks(query: string, token: string, limit = 10): Promise<Track[]> {
  if (!query.trim()) return [];
  const json = await searchSpotify(query, token, 'track', limit);
  return (json?.tracks?.items ?? []).map(mapSpotifyTrack);
}

// ── Playback control (Spotify Connect — "Option A") ──────────────────────
// These endpoints never touch audio data. They send commands to whichever
// device is already running the real Spotify app, which does the actual
// decoding/output. See README section 5 for the full explanation.

export interface SpotifyDevice {
  id: string;
  name: string;
  is_active: boolean;
  type: string;
}

export async function getDevices(token: string): Promise<SpotifyDevice[]> {
  const json = await spotifyFetch('/me/player/devices', token);
  return json?.devices ?? [];
}

export async function getPlaybackState(token: string) {
  return spotifyFetch('/me/player', token);
}

export async function playOnDevice(
  token: string,
  deviceId: string,
  uris: string[],
  offsetUri?: string,
) {
  const body: Record<string, unknown> = { uris };
  if (offsetUri) body.offset = { uri: offsetUri };
  return spotifyFetch(`/me/player/play?device_id=${deviceId}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function transferPlayback(token: string, deviceId: string, play = true) {
  return spotifyFetch('/me/player', token, {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

// Not independently re-verified against the Feb 2026 changes (same caveat as
// removeTrackFromPlaylist) — this endpoint wasn't in the removed list from
// what was reachable, but test before relying on it. See README section 8.
export async function addToPlaybackQueue(token: string, uri: string, deviceId?: string) {
  const q = deviceId ? `&device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}${q}`, token, { method: 'POST' });
}

// Spotify's public, unauthenticated scannable-code image generator. No API
// call needed — this is just the image URL for a given track/album/artist URI.
export function getSpotifyCodeImageUrl(uri: string): string {
  return `https://scannables.scdn.co/uri/plain/png/121212/white/640/${encodeURIComponent(uri)}`;
}

export async function pausePlayback(token: string, deviceId?: string) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/pause${q}`, token, { method: 'PUT' });
}

export async function resumePlayback(token: string, deviceId?: string) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/play${q}`, token, { method: 'PUT' });
}

export async function skipToNext(token: string, deviceId?: string) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/next${q}`, token, { method: 'POST' });
}

export async function skipToPrevious(token: string, deviceId?: string) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/previous${q}`, token, { method: 'POST' });
}

export async function seekPlayback(token: string, positionMs: number, deviceId?: string) {
  const q = deviceId ? `&device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/seek?position_ms=${Math.round(positionMs)}${q}`, token, { method: 'PUT' });
}

// Confirmed via Spotify's own reference docs. Fixes a real gap found in the
// Feb 2026 audit: the Shuffle/Repeat buttons only changed local state and
// never told the real Connect device to actually shuffle or repeat.
export async function setShuffleState(token: string, state: boolean, deviceId?: string) {
  const q = deviceId ? `&device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/shuffle?state=${state}${q}`, token, { method: 'PUT' });
}

export async function setRepeatState(token: string, state: 'track' | 'context' | 'off', deviceId?: string) {
  const q = deviceId ? `&device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/repeat?state=${state}${q}`, token, { method: 'PUT' });
}

export async function setVolume(token: string, percent: number, deviceId?: string) {
  const q = deviceId ? `&device_id=${deviceId}` : '';
  return spotifyFetch(`/me/player/volume?volume_percent=${Math.round(percent)}${q}`, token, { method: 'PUT' });
}

// ── Generic library (save/remove/check) ───────────────────────────────────
// Feb 2026 folded tracks, albums, shows, episodes, AND following an artist
// into one generic mechanism keyed by URI — there's no per-type endpoint
// anymore. `saveToLibrary`/`removeFromLibrary` work for any of those URI
// types; `isInLibrary` is the one confirmed GET left (single-item check —
// there is still no way to list everything saved, see README section 9).

export async function saveToLibrary(token: string, uris: string[]) {
  return spotifyFetch('/me/library', token, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
  });
}

export async function removeFromLibrary(token: string, uris: string[]) {
  return spotifyFetch('/me/library', token, {
    method: 'DELETE',
    body: JSON.stringify({ uris }),
  });
}

export async function isInLibrary(token: string, uri: string): Promise<boolean> {
  const json = await spotifyFetch(`/me/library/contains?uris=${encodeURIComponent(uri)}`, token);
  return Array.isArray(json) ? !!json[0] : false;
}
