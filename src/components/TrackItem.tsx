import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { usePlayerStore } from '../state/playerStore';
import { useUIStore } from '../state/uiStore';
import { Colors, FontSize, Spacing } from '../theme';
import { Track } from '../types';

interface Props {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress?: (track: Track) => void;
  isActive?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackItem({ track, onPress, onLongPress, isActive }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const openTrackActions = useUIStore((s) => s.openTrackActions);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const handleSwipeAddToQueue = async () => {
    swipeRef.current?.close();
    await addToQueue(track);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Could not add to queue', err);
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={() => (
        <TouchableOpacity style={styles.queueAction} onPress={handleSwipeAddToQueue}>
          <Ionicons name="list" size={22} color={Colors.background} />
          <Text style={styles.queueActionText}>Add to Queue</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={() => onPress(track)}
        onLongPress={onLongPress ? () => onLongPress(track) : undefined}
        activeOpacity={0.7}
      >
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
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => openTrackActions(track)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
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
  moreBtn: {
    marginLeft: Spacing.sm,
  },
  queueAction: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    gap: 2,
  },
  queueActionText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
