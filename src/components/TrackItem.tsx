import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';
import { Track } from '../types';

interface Props {
  track: Track;
  onPress: (track: Track) => void;
  isActive?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackItem({ track, onPress, isActive }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(track)} activeOpacity={0.7}>
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkFallback]} />
      )}
      <View style={styles.info}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: Colors.surfaceHighlight,
  },
  artworkFallback: {
    backgroundColor: Colors.surfaceHighlight,
  },
  info: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  titleActive: {
    color: Colors.primary,
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  duration: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
