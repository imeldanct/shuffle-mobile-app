import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getTrending } from '../api/audius';
import TrackItem from '../components/TrackItem';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';
import { Track } from '../types';

export default function HomeScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playTrack, currentTrack } = usePlayerStore();

  useEffect(() => {
    getTrending(30)
      .then(setTracks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handlePress = useCallback(
    (track: Track) => playTrack(track, tracks),
    [tracks, playTrack]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={tracks}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <Text style={styles.heading}>Trending</Text>
      }
      renderItem={({ item }) => (
        <TrackItem
          track={item}
          onPress={handlePress}
          isActive={currentTrack?.id === item.id}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  heading: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
  errorText: { color: Colors.danger, fontSize: FontSize.md },
});
