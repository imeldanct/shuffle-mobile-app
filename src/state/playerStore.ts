import { Audio, AVPlaybackStatus } from 'expo-av';
import { create } from 'zustand';
import { Track, RepeatMode } from '../types';

Audio.setAudioModeAsync({
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
});

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  isShuffle: boolean;
  likedIds: Set<string>;

  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  toggleLike: (id: string) => void;
  isLiked: (id: string) => boolean;

  _sound: Audio.Sound | null;
  _onPlaybackUpdate: (status: AVPlaybackStatus) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  repeat: 'off',
  isShuffle: false,
  likedIds: new Set(),
  _sound: null,

  _onPlaybackUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    set({
      isPlaying: status.isPlaying,
      positionMs: status.positionMillis,
      durationMs: status.durationMillis ?? 0,
    });
    if (status.didJustFinish) {
      const { repeat } = get();
      if (repeat === 'one') {
        get()._sound?.replayAsync();
      } else {
        get().skipNext();
      }
    }
  },

  async playTrack(track, queue) {
    const { _sound, _onPlaybackUpdate } = get();
    if (_sound) await _sound.unloadAsync();

    set({ currentTrack: track, isLoading: true, positionMs: 0 });
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      set({ queue, queueIndex: idx >= 0 ? idx : 0 });
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.streamUrl },
        { shouldPlay: true },
        get()._onPlaybackUpdate
      );
      set({ _sound: sound, isLoading: false, isPlaying: true });
    } catch (e) {
      set({ isLoading: false });
      console.error('playTrack error:', e);
    }
  },

  async togglePlay() {
    const { _sound, isPlaying } = get();
    if (!_sound) return;
    if (isPlaying) await _sound.pauseAsync();
    else await _sound.playAsync();
  },

  async seekTo(ms) {
    const { _sound } = get();
    if (_sound) await _sound.setPositionAsync(ms);
  },

  async skipNext() {
    const { queue, queueIndex, repeat, isShuffle } = get();
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
    const { positionMs, queueIndex, queue } = get();
    if (positionMs > 3000) {
      await get().seekTo(0);
      return;
    }
    const prevIdx = Math.max(0, queueIndex - 1);
    set({ queueIndex: prevIdx });
    await get().playTrack(queue[prevIdx], queue);
  },

  setRepeat(mode) { set({ repeat: mode }); },

  toggleShuffle() { set((s) => ({ isShuffle: !s.isShuffle })); },

  toggleLike(id) {
    set((s) => {
      const next = new Set(s.likedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { likedIds: next };
    });
  },

  isLiked(id) { return get().likedIds.has(id); },
}));
