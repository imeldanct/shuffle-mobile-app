export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  duration: number; // seconds
  artworkUrl: string | null;
  streamUrl: string;
  genre: string | null;
  playCount: number;
  source: 'audius' | 'spotify';
  spotifyUri?: string; // e.g. "spotify:track:xxxx" — only set when source === 'spotify'
  albumId?: string; // only set when source === 'spotify'
}

export type RepeatMode = 'off' | 'one' | 'all';
