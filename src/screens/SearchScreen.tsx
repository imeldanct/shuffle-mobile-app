import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchTracks } from '../api/audius';
import TrackItem from '../components/TrackItem';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { Track } from '../types';

const GENRES = [
  { label: 'Hip-Hop', color: '#ba5d07' },
  { label: 'Electronic', color: '#0d73ec' },
  { label: 'Pop', color: '#8400e7' },
  { label: 'R&B', color: '#1e3264' },
  { label: 'Rock', color: '#e8115b' },
  { label: 'Jazz', color: '#006450' },
  { label: 'Classical', color: '#e13300' },
  { label: 'Lo-Fi', color: '#477d95' },
  { label: 'Ambient', color: '#148a08' },
  { label: 'Metal', color: '#503750' },
  { label: 'Folk', color: '#8c6f3e' },
  { label: 'Trap', color: '#1e3264' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playTrack, currentTrack } = usePlayerStore();
  const insets = useSafeAreaInsets();

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    setActive(text.trim().length > 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchTracks(text));
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleGenre = useCallback((genre: string) => {
    handleChange(genre);
  }, [handleChange]);

  const handlePress = useCallback((track: Track) => {
    playTrack(track, results);
  }, [results, playTrack]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="What do you want to listen to?"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={handleChange}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Browse grid — shown when not searching */}
      {!active && (
        <ScrollView contentContainerStyle={styles.grid}>
          <Text style={styles.browseTitle}>Browse categories</Text>
          <View style={styles.genreGrid}>
            {GENRES.map((g) => (
              <TouchableOpacity
                key={g.label}
                style={[styles.genreCard, { backgroundColor: g.color }]}
                onPress={() => handleGenre(g.label)}
                activeOpacity={0.8}
              >
                <Text style={styles.genreLabel}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Search results */}
      {active && loading && (
        <ActivityIndicator color={Colors.primary} style={styles.spinner} />
      )}
      {active && !loading && results.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>No results for "{query}"</Text>
        </View>
      )}
      {active && !loading && results.length > 0 && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inputWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  input: {
    backgroundColor: Colors.text,
    color: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  browseTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  grid: { paddingBottom: Spacing.xxl },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  genreCard: {
    width: '47%',
    height: 96,
    borderRadius: BorderRadius.md,
    justifyContent: 'flex-end',
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  genreLabel: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  spinner: { marginTop: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: Colors.textSecondary, fontSize: FontSize.md },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
});
