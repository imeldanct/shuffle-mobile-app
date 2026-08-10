import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackItem from '../components/TrackItem';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { Track } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LikedSongsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { likedTracks, currentTrack, playTrack, playSpotifyTrack } = usePlayerStore();
  const tracks = Object.values(likedTracks);

  const handlePress = useCallback(async (track: Track) => {
    if (track.source === 'spotify') {
      await playSpotifyTrack(track, tracks);
      const err = usePlayerStore.getState().remoteError;
      if (err) Alert.alert('Playback unavailable', err);
    } else {
      playTrack(track, tracks);
    }
  }, [tracks, playTrack, playSpotifyTrack]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={28} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="heart" size={40} color={Colors.primary} />
        <Text style={styles.title}>Liked in Shuffle</Text>
        <Text style={styles.sub}>
          Songs you've liked using Shuffle. Spotify no longer lets apps read your full
          liked-songs history, so this list only covers what you like from here on —
          see the README for why.
        </Text>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing liked yet. Tap the heart on a track to add it here.</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={handlePress}
              isActive={currentTrack?.id === item.id}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  back: { padding: Spacing.md },
  header: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 18 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
});
