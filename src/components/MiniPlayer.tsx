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
  const { currentTrack, isPlaying, isLoading, togglePlay } = usePlayerStore();

  if (!currentTrack) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('NowPlaying')}
      activeOpacity={0.9}
    >
      {currentTrack.artworkUrl ? (
        <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkFallback]} />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
      </View>
      <TouchableOpacity
        style={styles.btn}
        onPress={(e) => { e.stopPropagation(); togglePlay(); }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.text} size="small" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={Colors.text} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={(e) => { e.stopPropagation(); }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  artwork: {
    width: 40,
    height: 40,
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
  btn: {
    width: 32,
    alignItems: 'center',
  },
});
