import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { create } from 'zustand';
import { Track, RepeatMode } from '../types';
import { useAuthStore } from './authStore';
import {
  addToPlaybackQueue,
  mapSpotifyTrack,
  getDevices,
  getPlaybackState,
  pausePlayback,
  playOnDevice,
  removeFromLibrary,
  resumePlayback,
  saveToLibrary,
  seekPlayback,
  setRepeatState,
  setShuffleState,
  setVolume as apiSetVolume,
  skipToNext as spotifySkipNext,
  skipToPrevious as spotifySkipPrevious,
  SpotifyAlbum,
  SpotifyDevice,
  transferPlayback,
} from '../api/spotify';

export interface FollowedArtist {
  id: string;
  name: string;
  imageUrl: string | null;
}

const LIKED_STORAGE_KEY = 'shuffle_liked_v1';
const RECENT_STORAGE_KEY = 'shuffle_recent_v1';
const RECENT_LIMIT = 20;
const SAVED_ALBUMS_STORAGE_KEY = 'shuffle_saved_albums_v1';
const FOLLOWED_ARTISTS_STORAGE_KEY = 'shuffle_followed_artists_v1';

setAudioModeAsync({
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  shouldPlayInBackground: true,
});

// Follow Audius redirect chain to get the final CDN URL so iOS AVPlayer
// doesn't choke on intermediate content-node domains it can't resolve.
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    });
    return res.url || url;
  } catch {
    return url;
  }
}

type PlaybackMode = 'local' | 'remote';

interface PlayerState {
  mode: PlaybackMode;
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  isShuffle: boolean;
  // "Liked in Shuffle" — not Spotify's own liked-songs list, which can no
  // longer be read back via the API (see README section 9). Keyed by track id.
  likedTracks: Record<string, Track>;
  // Shuffle's own history — Spotify doesn't give a reliable way to read this
  // back, but Shuffle sees every track it plays anyway. See README section 11.
  recentlyPlayed: Track[];
  remoteError: string | null;
  remoteDeviceId: string | null;
  availableDevices: SpotifyDevice[];
  volume: number;
  // "Saved Albums in Shuffle" / "Followed Artists in Shuffle" — Spotify removed
  // GET /me/albums and GET /me/following (list) in Feb 2026, no replacement.
  // Same pattern as Liked Songs: keep our own copy, mirror writes for real.
  savedAlbums: Record<string, SpotifyAlbum>;
  followedArtists: Record<string, FollowedArtist>;

  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  playSpotifyTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  setRepeat: (mode: RepeatMode) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  loadLikedFromStorage: () => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;
  isLiked: (id: string) => boolean;
  loadRecentFromStorage: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  switchDevice: (deviceId: string) => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  setVolume: (percent: number) => Promise<void>;
  loadSavedAlbumsFromStorage: () => Promise<void>;
  setSavedAlbum: (album: SpotifyAlbum, isSaved: boolean) => Promise<void>;
  isAlbumSaved: (id: string) => boolean;
  loadFollowedArtistsFromStorage: () => Promise<void>;
  setFollowedArtistLocally: (artist: FollowedArtist, isFollowing: boolean) => Promise<void>;
  isArtistFollowedLocally: (id: string) => boolean;

  _player: AudioPlayer | null;
  _pollInterval: ReturnType<typeof setInterval> | null;
  _remotePollInterval: ReturnType<typeof setInterval> | null;
}

// Stops whichever engine (local expo-audio player, or remote poll loop) is currently active.
function teardownPlayback(get: () => PlayerState, set: (partial: Partial<PlayerState>) => void) {
  const { _player, _pollInterval, _remotePollInterval } = get();
  if (_pollInterval) clearInterval(_pollInterval);
  if (_remotePollInterval) clearInterval(_remotePollInterval);
  if (_player) _player.remove();
  set({ _player: null, _pollInterval: null, _remotePollInterval: null });
}

// Bumps a track to the front of Recently Played and persists it. Not part of
// the public store interface — every play path funnels through this.
async function recordRecentlyPlayed(
  get: () => PlayerState,
  set: (partial: Partial<PlayerState>) => void,
  track: Track,
) {
  const withoutTrack = get().recentlyPlayed.filter((t) => t.id !== track.id);
  const next = [track, ...withoutTrack].slice(0, RECENT_LIMIT);
  set({ recentlyPlayed: next });
  await AsyncStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  mode: 'local',
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  repeat: 'off',
  isShuffle: false,
  likedTracks: {},
  recentlyPlayed: [],
  remoteError: null,
  remoteDeviceId: null,
  availableDevices: [],
  volume: 100,
  savedAlbums: {},
  followedArtists: {},
  _player: null,
  _pollInterval: null,
  _remotePollInterval: null,

  // Local playback — Audius stream via expo-audio.
  async playTrack(track, queue) {
    teardownPlayback(get, set);

    set({ mode: 'local', currentTrack: track, isLoading: true, positionMs: 0, remoteError: null });
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      set({ queue, queueIndex: idx >= 0 ? idx : 0 });
    }

    try {
      const resolvedUrl = await resolveUrl(track.streamUrl);
      const player = createAudioPlayer({ uri: resolvedUrl });

      // Poll position + duration every 500ms
      const interval = setInterval(() => {
        const p = get()._player;
        if (!p) return;
        const posMs = Math.floor((p.currentTime ?? 0) * 1000);
        const durMs = Math.floor((p.duration ?? 0) * 1000);
        set({ positionMs: posMs, durationMs: durMs, isPlaying: p.playing });

        // Auto-advance when finished
        if (durMs > 0 && posMs >= durMs - 500) {
          const { repeat } = get();
          if (repeat === 'one') {
            p.seekTo(0);
          } else {
            get().skipNext();
          }
        }
      }, 500);

      player.play();
      set({ _player: player, _pollInterval: interval, isLoading: false, isPlaying: true });
      recordRecentlyPlayed(get, set, track);
    } catch (e) {
      set({ isLoading: false });
      console.error('playTrack error:', e);
    }
  },

  // Remote playback — Option A: tell the real Spotify app (Connect) what to play.
  // We never touch the audio itself; see README section 5.
  async playSpotifyTrack(track, queue) {
    teardownPlayback(get, set);
    set({ isLoading: true, remoteError: null });

    if (!track.spotifyUri) {
      set({ isLoading: false, remoteError: 'This track is not available to play.' });
      return;
    }

    const token = await useAuthStore.getState().getValidToken();
    if (!token) {
      set({ isLoading: false, remoteError: 'Log in with Spotify to play this track.' });
      return;
    }

    let deviceId: string;
    try {
      const devices = await getDevices(token);
      const active = devices.find((d) => d.is_active) ?? devices[0];
      if (!active) {
        set({ isLoading: false, remoteError: 'Open Spotify on a device first, then try again.' });
        return;
      }
      deviceId = active.id;
    } catch (e) {
      set({ isLoading: false, remoteError: 'Could not reach Spotify. Try again.' });
      console.error('getDevices error:', e);
      return;
    }

    const list = queue && queue.length ? queue : [track];
    const filteredUris = list.filter((t) => t.spotifyUri).map((t) => t.spotifyUri!);
    const uris = filteredUris.length > 0 ? filteredUris : [track.spotifyUri!];
    const idx = list.findIndex((t) => t.id === track.id);

    try {
      await playOnDevice(token, deviceId, uris, track.spotifyUri);
      set({
        mode: 'remote',
        remoteDeviceId: deviceId,
        currentTrack: track,
        queue: list,
        queueIndex: idx >= 0 ? idx : 0,
        isLoading: false,
        isPlaying: true,
        positionMs: 0,
        durationMs: track.duration * 1000,
      });
      recordRecentlyPlayed(get, set, track);
    } catch (e) {
      set({ isLoading: false, remoteError: 'Spotify could not start playback on that device.' });
      console.error('playOnDevice error:', e);
      return;
    }

    // Poll Spotify Connect for real playback state every second.
    const interval = setInterval(async () => {
      if (get().mode !== 'remote') return;
      const t = await useAuthStore.getState().getValidToken();
      if (!t) return;
      try {
        const state = await getPlaybackState(t);
        if (!state) return;
        const posMs = state.progress_ms ?? 0;
        const durMs = state.item?.duration_ms ?? get().durationMs;
        set({ positionMs: posMs, durationMs: durMs, isPlaying: !!state.is_playing });

        const polledId = state.item?.id;
        if (polledId && polledId !== get().currentTrack?.id) {
          const mapped = mapSpotifyTrack(state.item);
          const matchIdx = get().queue.findIndex((qt) => qt.id === mapped.id);
          set({ currentTrack: mapped, queueIndex: matchIdx >= 0 ? matchIdx : get().queueIndex });
        }
      } catch (e) {
        console.error('remote poll error:', e);
      }
    }, 1000);
    set({ _remotePollInterval: interval });
  },

  async togglePlay() {
    const { mode, _player, isPlaying, remoteDeviceId } = get();

    if (mode === 'remote') {
      const token = await useAuthStore.getState().getValidToken();
      if (!token) return;
      try {
        if (isPlaying) {
          await pausePlayback(token, remoteDeviceId ?? undefined);
        } else {
          await resumePlayback(token, remoteDeviceId ?? undefined);
        }
        set({ isPlaying: !isPlaying });
      } catch (e) {
        console.error('togglePlay (remote) error:', e);
      }
      return;
    }

    if (!_player) return;
    if (isPlaying) {
      _player.pause();
      set({ isPlaying: false });
    } else {
      _player.play();
      set({ isPlaying: true });
    }
  },

  async seekTo(ms) {
    const { mode, _player, remoteDeviceId } = get();

    if (mode === 'remote') {
      const token = await useAuthStore.getState().getValidToken();
      if (!token) return;
      try {
        await seekPlayback(token, ms, remoteDeviceId ?? undefined);
        set({ positionMs: ms });
      } catch (e) {
        console.error('seekTo (remote) error:', e);
      }
      return;
    }

    if (_player) _player.seekTo(ms / 1000);
  },

  async skipNext() {
    const { mode, queue, queueIndex, repeat, isShuffle, remoteDeviceId } = get();

    if (mode === 'remote') {
      const token = await useAuthStore.getState().getValidToken();
      if (!token) return;
      try {
        await spotifySkipNext(token, remoteDeviceId ?? undefined);
      } catch (e) {
        console.error('skipNext (remote) error:', e);
      }
      return;
    }

    if (!queue.length) return;
    let nextIdx: number;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeat === 'all') nextIdx = 0;
        else return;
      }
    }
    set({ queueIndex: nextIdx });
    await get().playTrack(queue[nextIdx], queue);
  },

  async skipPrev() {
    const { mode, positionMs, queueIndex, queue, remoteDeviceId } = get();

    if (mode === 'remote') {
      const token = await useAuthStore.getState().getValidToken();
      if (!token) return;
      try {
        await spotifySkipPrevious(token, remoteDeviceId ?? undefined);
      } catch (e) {
        console.error('skipPrev (remote) error:', e);
      }
      return;
    }

    if (positionMs > 3000) {
      await get().seekTo(0);
      return;
    }
    const prevIdx = Math.max(0, queueIndex - 1);
    set({ queueIndex: prevIdx });
    await get().playTrack(queue[prevIdx], queue);
  },

  async setRepeat(mode) {
    set({ repeat: mode });
    if (get().mode !== 'remote') return;
    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    const spotifyState = mode === 'one' ? 'track' : mode === 'all' ? 'context' : 'off';
    try {
      await setRepeatState(token, spotifyState, get().remoteDeviceId ?? undefined);
    } catch (e) {
      console.error('setRepeat (remote) error:', e);
    }
  },

  async toggleShuffle() {
    const next = !get().isShuffle;
    set({ isShuffle: next });
    if (get().mode !== 'remote') return;
    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    try {
      await setShuffleState(token, next, get().remoteDeviceId ?? undefined);
    } catch (e) {
      console.error('toggleShuffle (remote) error:', e);
    }
  },

  async loadLikedFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(LIKED_STORAGE_KEY);
      if (raw) set({ likedTracks: JSON.parse(raw) });
    } catch {
      // corrupted storage — start fresh
    }
  },

  async toggleLike(track) {
    const wasLiked = !!get().likedTracks[track.id];
    const nextLiked = { ...get().likedTracks };
    if (wasLiked) delete nextLiked[track.id];
    else nextLiked[track.id] = track;

    set({ likedTracks: nextLiked });
    await AsyncStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(nextLiked));

    // Mirror to the real account — write-only, see README section 9.
    if (track.source === 'spotify' && track.spotifyUri) {
      const token = await useAuthStore.getState().getValidToken();
      if (token) {
        try {
          if (wasLiked) await removeFromLibrary(token, [track.spotifyUri]);
          else await saveToLibrary(token, [track.spotifyUri]);
        } catch (e) {
          console.error('library mirror error:', e);
        }
      }
    }
  },

  isLiked(id) { return !!get().likedTracks[id]; },

  async loadRecentFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(RECENT_STORAGE_KEY);
      if (raw) set({ recentlyPlayed: JSON.parse(raw) });
    } catch {
      // corrupted storage — start fresh
    }
  },

  async refreshDevices() {
    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    try {
      set({ availableDevices: await getDevices(token) });
    } catch (e) {
      console.error('refreshDevices error:', e);
    }
  },

  async switchDevice(deviceId) {
    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    try {
      await transferPlayback(token, deviceId, get().isPlaying);
      set({ mode: 'remote', remoteDeviceId: deviceId });
    } catch (e) {
      console.error('switchDevice error:', e);
      set({ remoteError: 'Could not switch device. Try again.' });
    }
  },

  async addToQueue(track) {
    const { mode, queue, queueIndex, remoteDeviceId } = get();

    // Keep Shuffle's own queue view in sync either way, right after the current track.
    const nextQueue = [...queue];
    nextQueue.splice(queueIndex + 1, 0, track);
    set({ queue: nextQueue });

    if (mode === 'remote' && track.spotifyUri) {
      const token = await useAuthStore.getState().getValidToken();
      if (!token) return;
      try {
        await addToPlaybackQueue(token, track.spotifyUri, remoteDeviceId ?? undefined);
      } catch (e) {
        console.error('addToQueue error:', e);
        set({ remoteError: 'Could not add to queue. Try again.' });
      }
    }
  },

  async setVolume(percent) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    set({ volume: clamped });
    if (get().mode !== 'remote') return;
    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    try {
      await apiSetVolume(token, clamped, get().remoteDeviceId ?? undefined);
    } catch (e) {
      console.error('setVolume error:', e);
    }
  },

  async loadSavedAlbumsFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(SAVED_ALBUMS_STORAGE_KEY);
      if (raw) set({ savedAlbums: JSON.parse(raw) });
    } catch {
      // corrupted storage — start fresh
    }
  },

  // Takes the intended end state explicitly — same reasoning as
  // setFollowedArtistLocally, since the local list can desync from the real
  // saved state (e.g. saved via the real Spotify app before Shuffle knew).
  async setSavedAlbum(album, isSaved) {
    const next = { ...get().savedAlbums };
    if (isSaved) next[album.id] = album;
    else delete next[album.id];

    set({ savedAlbums: next });
    await AsyncStorage.setItem(SAVED_ALBUMS_STORAGE_KEY, JSON.stringify(next));

    const token = await useAuthStore.getState().getValidToken();
    if (!token) return;
    const uri = `spotify:album:${album.id}`;
    try {
      if (isSaved) await saveToLibrary(token, [uri]);
      else await removeFromLibrary(token, [uri]);
    } catch (e) {
      console.error('setSavedAlbum error:', e);
    }
  },

  isAlbumSaved(id) { return !!get().savedAlbums[id]; },

  async loadFollowedArtistsFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(FOLLOWED_ARTISTS_STORAGE_KEY);
      if (raw) set({ followedArtists: JSON.parse(raw) });
    } catch {
      // corrupted storage — start fresh
    }
  },

  // Takes the intended end state explicitly rather than blindly toggling —
  // this local list can desync from the real follow state (e.g. you followed
  // an artist in the real Spotify app before ever opening Shuffle), so the
  // caller (which just made the real API call) tells us which way it went.
  async setFollowedArtistLocally(artist, isFollowing) {
    const next = { ...get().followedArtists };
    if (isFollowing) next[artist.id] = artist;
    else delete next[artist.id];

    set({ followedArtists: next });
    await AsyncStorage.setItem(FOLLOWED_ARTISTS_STORAGE_KEY, JSON.stringify(next));
  },

  isArtistFollowedLocally(id) { return !!get().followedArtists[id]; },
}));
