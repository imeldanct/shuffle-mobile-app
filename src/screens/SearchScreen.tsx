import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchTracks } from '../api/audius';
import TrackItem from '../components/TrackItem';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { Track } from '../types';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playTrack, currentTrack } = usePlayerStore();

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const tracks = await searchTracks(text);
        setResults(tracks);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handlePress = useCallback(
    (track: Track) => playTrack(track, results),
    [results, playTrack]
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Artists, songs, podcasts…"
        placeholderTextColor={Colors.textMuted}
        value={query}
        onChangeText={handleChange}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {loading && (
        <ActivityIndicator color={Colors.primary} style={styles.spinner} />
      )}
      {!loading && query.trim() !== '' && results.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>No results for "{query}"</Text>
        </View>
      )}
      <FlatList
        data={results}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            onPress={handlePress}
            isActive={currentTrack?.id === item.id}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  input: {
    backgroundColor: Colors.surfaceHighlight,
    color: Colors.text,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  spinner: { marginTop: Spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxl },
  empty: { color: Colors.textSecondary, fontSize: FontSize.md },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
});
