import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { create } from 'zustand';
import { Track, RepeatMode } from '../types';

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

  _player: AudioPlayer | null;
  _pollInterval: ReturnType<typeof setInterval> | null;
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
  _player: null,
  _pollInterval: null,

  async playTrack(track, queue) {
    const { _player, _pollInterval } = get();

    if (_pollInterval) clearInterval(_pollInterval);
    if (_player) _player.remove();

    set({ currentTrack: track, isLoading: true, positionMs: 0 });
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
    } catch (e) {
      set({ isLoading: false });
      console.error('playTrack error:', e);
    }
  },

  async togglePlay() {
    const { _player, isPlaying } = get();
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
    const { _player } = get();
    if (_player) _player.seekTo(ms / 1000);
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
