import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingScreen() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    positionMs,
    durationMs,
    repeat,
    isShuffle,
    togglePlay,
    seekTo,
    skipNext,
    skipPrev,
    setRepeat,
    toggleShuffle,
    toggleLike,
    isLiked,
  } = usePlayerStore();

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  const cycleRepeat = useCallback(() => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  }, [repeat, setRepeat]);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  if (!currentTrack) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing playing yet.</Text>
        <Text style={styles.emptyHint}>Pick a track from Home or Search.</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#1a3a2a', Colors.background]} style={styles.container}>
      {/* Artwork */}
      <View style={styles.artworkWrap}>
        {currentTrack.artworkUrl ? (
          <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkFallback]} />
        )}
      </View>

      {/* Track info + like */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleLike(currentTrack.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <TouchableOpacity
          style={styles.progressBar}
          onPress={(e) => {
            if (durationMs > 0) {
              const { locationX } = e.nativeEvent;
              // approximate — proper slider would use PanResponder
              seekTo(progress * durationMs);
            }
          }}
          activeOpacity={1}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
          </View>
        </TouchableOpacity>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatMs(positionMs)}</Text>
          <Text style={styles.time}>{formatMs(durationMs)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons
            name="shuffle"
            size={24}
            color={isShuffle ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={34} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          {isLoading ? (
            <ActivityIndicator color={Colors.background} size="large" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color={Colors.background}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={34} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={cycleRepeat}>
          <Ionicons
            name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
            size={24}
            color={repeat !== 'off' ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  emptyText: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
  emptyHint: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },

  artworkWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  artwork: { width: 280, height: 280, borderRadius: 8 },
  artworkFallback: { backgroundColor: Colors.surfaceHighlight },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  infoText: { flex: 1, marginRight: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  artist: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: 4 },

  progressWrap: { marginBottom: Spacing.lg },
  progressBar: { paddingVertical: Spacing.sm },
  progressTrack: { height: 4, backgroundColor: Colors.surfaceHighlight, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.text,
    marginLeft: -7,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  time: { color: Colors.textMuted, fontSize: FontSize.xs },

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
