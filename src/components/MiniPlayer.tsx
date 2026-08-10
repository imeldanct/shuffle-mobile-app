import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MiniPlayer() {
  const navigation = useNavigation<Nav>();
  const {
    currentTrack, isPlaying, isLoading, positionMs, durationMs,
    mode, togglePlay, toggleLike, isLiked,
  } = usePlayerStore();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('NowPlaying')}
      activeOpacity={0.9}
    >
      {/* Thin progress line along the top edge — same detail real Spotify's mini player has */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <View style={styles.row}>
        {currentTrack.artworkUrl ? (
          <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkFallback]} />
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>

        {mode === 'remote' && (
          <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} style={styles.deviceIcon} />
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={(e) => { e.stopPropagation(); toggleLike(currentTrack); }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Ionicons name={liked ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={liked ? Colors.primary : Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btn}
          onPress={(e) => { e.stopPropagation(); togglePlay(); }}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={Colors.text} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceHighlight,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  artworkFallback: {
    backgroundColor: Colors.surface,
  },
  info: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  deviceIcon: {
    marginHorizontal: Spacing.xs,
  },
  btn: {
    width: 32,
    alignItems: 'center',
  },
});
