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
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export type RepeatMode = 'off' | 'one' | 'all';
