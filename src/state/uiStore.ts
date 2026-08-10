import { create } from 'zustand';
import { Track } from '../types';

// Modal state that needs to be reachable from more than one screen at once —
// e.g. the "..." menu on a track can be opened from Search, Artist, Album,
// Playlist, Liked Songs, or Queue, and the Create tab needs to open the same
// "new playlist" flow Library uses. Kept separate from playerStore since none
// of this is playback state.
interface UIState {
  createPlaylistModalVisible: boolean;
  openCreatePlaylistModal: () => void;
  closeCreatePlaylistModal: () => void;

  actionSheetTrack: Track | null;
  openTrackActions: (track: Track) => void;
  closeTrackActions: () => void;

  addToPlaylistTrack: Track | null;
  openAddToPlaylist: (track: Track) => void;
  closeAddToPlaylist: () => void;

  spotifyCodeTrack: Track | null;
  openSpotifyCode: (track: Track) => void;
  closeSpotifyCode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  createPlaylistModalVisible: false,
  openCreatePlaylistModal: () => set({ createPlaylistModalVisible: true }),
  closeCreatePlaylistModal: () => set({ createPlaylistModalVisible: false }),

  actionSheetTrack: null,
  openTrackActions: (track) => set({ actionSheetTrack: track }),
  closeTrackActions: () => set({ actionSheetTrack: null }),

  addToPlaylistTrack: null,
  openAddToPlaylist: (track) => set({ addToPlaylistTrack: track }),
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null }),

  spotifyCodeTrack: null,
  openSpotifyCode: (track) => set({ spotifyCodeTrack: track }),
  closeSpotifyCode: () => set({ spotifyCodeTrack: null }),
}));
