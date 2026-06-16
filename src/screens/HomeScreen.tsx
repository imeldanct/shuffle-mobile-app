import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTrending } from '../api/audius';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing, BorderRadius } from '../theme';
import { Track } from '../types';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'All' | 'Music' | 'Podcasts';

function TrackCard({ track, onPress }: { track: Track; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={styles.cardArt} />
      ) : (
        <View style={[styles.cardArt, styles.cardArtFallback]} />
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>{track.title}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{track.artist}</Text>
    </TouchableOpacity>
  );
}

function RecentChip({ track, onPress }: { track: Track; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.7}>
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={styles.chipArt} />
      ) : (
        <View style={[styles.chipArt, styles.cardArtFallback]} />
      )}
      <Text style={styles.chipTitle} numberOfLines={1}>{track.title}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [trending, setTrending] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const { playTrack } = usePlayerStore();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const tracks = await getTrending(40);
      setTrending(tracks);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const play = useCallback((track: Track) => {
    playTrack(track, trending);
  }, [trending, playTrack]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const recentChips = trending.slice(0, 6);
  const featured = trending.slice(0, 10);
  const newReleases = trending.slice(10, 20);
  const recommended = trending.slice(20, 30);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: Spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>A</Text>
          </View>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
          {(['All', 'Music', 'Podcasts'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, activeFilter === f && styles.pillActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recently played chips — two per row, each flex: 1 so they fill evenly */}
      <View style={styles.chipGrid}>
        {Array.from({ length: Math.ceil(recentChips.length / 2) }, (_, i) => (
          <View key={i} style={styles.chipRow}>
            {recentChips.slice(i * 2, i * 2 + 2).map((t) => (
              <RecentChip key={t.id} track={t} onPress={() => play(t)} />
            ))}
          </View>
        ))}
      </View>

      {/* Featured section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={featured}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
          renderItem={({ item }) => (
            <TrackCard track={item} onPress={() => play(item)} />
          )}
        />
      </View>

      {/* New releases */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Releases</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={newReleases}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
          renderItem={({ item }) => (
            <TrackCard track={item} onPress={() => play(item)} />
          )}
        />
      </View>

      {/* Recommended */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended For You</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={recommended}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
          renderItem={({ item }) => (
            <TrackCard track={item} onPress={() => play(item)} />
          )}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },
  pillsRow: { gap: Spacing.sm, paddingLeft: Spacing.xs },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceHighlight,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  pillTextActive: { color: Colors.background },
  chipGrid: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    height: 48,
  },
  chipArt: { width: 48, height: 48, backgroundColor: Colors.surface },
  chipTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
  },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  card: { width: 140 },
  cardArt: { width: 140, height: 140, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceHighlight },
  cardArtFallback: { backgroundColor: Colors.surfaceHighlight },
  cardTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500', marginTop: Spacing.sm },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
});
