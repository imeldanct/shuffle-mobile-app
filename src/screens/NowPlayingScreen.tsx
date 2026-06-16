import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const trackWidthRef = useRef(0);

  const {
    currentTrack, isPlaying, isLoading, positionMs, durationMs,
    repeat, isShuffle, togglePlay, seekTo, skipNext, skipPrev,
    setRepeat, toggleShuffle, toggleLike, isLiked,
  } = usePlayerStore();

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  const cycleRepeat = useCallback(() => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  }, [repeat, setRepeat]);

  const handleSeek = useCallback((e: any) => {
    if (durationMs > 0 && trackWidthRef.current > 0) {
      const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidthRef.current));
      seekTo(ratio * durationMs);
    }
  }, [durationMs, seekTo]);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const remaining = Math.max(0, durationMs - positionMs);

  if (!currentTrack) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing playing yet.</Text>
        <Text style={styles.emptyHint}>Pick a track from Home or Search.</Text>
      </View>
    );
  }

  const content = (
    <View style={[styles.inner, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom || Spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-down" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.context} numberOfLines={1}>Shuffle</Text>
        <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Large artwork */}
      <View style={styles.artworkWrap}>
        {currentTrack.artworkUrl ? (
          <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artwork} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.artworkFallback]} />
        )}
      </View>

      {/* Track info + heart */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(currentTrack.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Progress bar — tap or drag to seek */}
      <View style={styles.progressWrap}>
        <View
          style={styles.progressTouchable}
          onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleSeek}
          onResponderMove={handleSeek}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            <View style={[styles.progressThumb, { left: `${progress * 100}%` as any }]} />
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatMs(positionMs)}</Text>
          <Text style={styles.time}>-{formatMs(remaining)}</Text>
        </View>
      </View>

      {/* Playback controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={24} color={isShuffle ? Colors.primary : Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={32} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          {isLoading
            ? <ActivityIndicator color={Colors.background} size="large" />
            : <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={Colors.background} />
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={32} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat}>
          <Ionicons
            name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
            size={24}
            color={repeat !== 'off' ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Utility row */}
      <View style={styles.utilRow}>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="phone-portrait-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="share-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => navigation.navigate('Queue')}
        >
          <Ionicons name="list" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (currentTrack.artworkUrl) {
    return (
      <ImageBackground source={{ uri: currentTrack.artworkUrl }} style={styles.bg} blurRadius={80}>
        <View style={styles.overlay}>{content}</View>
      </ImageBackground>
    );
  }

  return <View style={[styles.bg, { backgroundColor: '#0a0a0a' }]}>{content}</View>;
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  inner: { flex: 1, paddingHorizontal: Spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  emptyText: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
  emptyHint: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  context: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', flex: 1, textAlign: 'center' },

  artworkWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md },
  artwork: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  artworkFallback: { backgroundColor: Colors.surfaceHighlight },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  infoText: { flex: 1, marginRight: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  artist: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: 4 },

  progressWrap: { marginBottom: Spacing.md },
  progressTouchable: { paddingVertical: Spacing.sm },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: Colors.text, borderRadius: 2 },
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
    marginBottom: Spacing.lg,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },

  utilRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
});
