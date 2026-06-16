import { Track } from '../types';

const BASE = 'https://api.audius.co/v1';
const APP = 'Shuffle';

function mapTrack(raw: any): Track {
  const artistName: string =
    raw.user?.name ?? raw.user?.handle ?? 'Unknown Artist';
  const artistId: string = raw.user?.id ?? '';

  const artworkUrl: string | null =
    raw.artwork?.['480x480'] ??
    raw.artwork?.['150x150'] ??
    null;

  return {
    id: raw.id,
    title: raw.title ?? 'Untitled',
    artist: artistName,
    artistId,
    duration: raw.duration ?? 0,
    artworkUrl,
    streamUrl: `${BASE}/tracks/${raw.id}/stream?app_name=${APP}`,
    genre: raw.genre ?? null,
    playCount: raw.play_count ?? 0,
  };
}

export async function getTrending(limit = 20): Promise<Track[]> {
  const res = await fetch(
    `${BASE}/tracks/trending?app_name=${APP}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Audius trending failed: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []).map(mapTrack);
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE}/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Audius search failed: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []).map(mapTrack);
}

export async function getTrack(id: string): Promise<Track> {
  const res = await fetch(`${BASE}/tracks/${id}?app_name=${APP}`);
  if (!res.ok) throw new Error(`Audius getTrack failed: ${res.status}`);
  const json = await res.json();
  return mapTrack(json.data);
}
