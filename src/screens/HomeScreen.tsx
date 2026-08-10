import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { getArtistPopularTracks, getUserPlaylists, getUserTopTracks, SpotifyPlaylist } from '../api/spotify';
import { useAuthStore } from '../state/authStore';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing, BorderRadius } from '../theme';
import { Track } from '../types';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'All' | 'Music';

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

function PlaylistCard({ playlist, onPress }: { playlist: SpotifyPlaylist; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {playlist.imageUrl ? (
        <Image source={{ uri: playlist.imageUrl }} style={styles.cardArt} />
      ) : (
        <View style={[styles.cardArt, styles.cardArtFallback]} />
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>{playlist.name}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{playlist.trackCount} songs</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [trending, setTrending] = useState<Track[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [shufflePicks, setShufflePicks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const { playTrack, playSpotifyTrack } = usePlayerStore();
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const { isAuthenticated, getValidToken } = useAuthStore();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      if (isAuthenticated) {
        // Real Spotify data. Note: /browse/featured-playlists and /browse/new-releases
        // are gone for Development Mode apps as of Feb 2026 — /me/top/tracks and
        // /me/playlists are the real, working sources left. See README section 7.
        const token = await getValidToken();
        if (token) {
          const [tracks, lists] = await Promise.all([
            getUserTopTracks(token, 10),
            getUserPlaylists(token, 10),
          ]);
          setTopTracks(tracks);
          setPlaylists(lists);

          // "Shuffle Picks" — our own homemade stand-in for Spotify's dead
          // /recommendations and /browse/new-releases (see README section 11).
          // Seeded from a couple of your own top-track artists, found via search.
          const seedArtists = [...new Set(tracks.map((t) => t.artist))].slice(0, 3);
          if (seedArtists.length > 0) {
            const results = await Promise.all(
              seedArtists.map((name) => getArtistPopularTracks(token, name, 5)),
            );
            const topTrackIds = new Set(tracks.map((t) => t.id));
            const seen = new Set<string>();
            const picks = results.flat().filter((t) => {
              if (topTrackIds.has(t.id) || seen.has(t.id)) return false;
              seen.add(t.id);
              return true;
            }).slice(0, 10);
            setShufflePicks(picks);
          }
        }
      } else {
        const tracks = await getTrending(40);
        setTrending(tracks);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, getValidToken]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const play = useCallback(async (track: Track, queue: Track[]) => {
    if (track.source === 'spotify') {
      await playSpotifyTrack(track, queue);
      const err = usePlayerStore.getState().remoteError;
      if (err) Alert.alert('Playback unavailable', err);
    } else {
      playTrack(track, queue);
    }
  }, [playTrack, playSpotifyTrack]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Logged in: Shuffle's own play history (Spotify doesn't give this back reliably —
  // see README section 11) — falls back to top tracks until you've played anything.
  // Logged out: Audius stand-in, sliced purely for visual variety.
  const recentChips = isAuthenticated
    ? (recentlyPlayed.length > 0 ? recentlyPlayed.slice(0, 6) : topTracks.slice(0, 6))
    : trending.slice(0, 6);
  const featured = isAuthenticated ? topTracks : trending.slice(0, 10);
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
          {(['All', 'Music'] as const).map((f) => (
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

      {/* Quick-access chips — two per row, each flex: 1 so they fill evenly */}
      <View style={styles.chipGrid}>
            {Array.from({ length: Math.ceil(recentChips.length / 2) }, (_, i) => (
              <View key={i} style={styles.chipRow}>
                {recentChips.slice(i * 2, i * 2 + 2).map((t) => (
                  <RecentChip key={t.id} track={t} onPress={() => play(t, recentChips)} />
                ))}
              </View>
            ))}
          </View>

          {/* Featured section — real Spotify top tracks when logged in, Audius trending otherwise */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isAuthenticated ? 'Your Top Tracks' : 'Trending Now'}</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={featured}
              keyExtractor={(t) => t.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
              renderItem={({ item }) => (
                <TrackCard track={item} onPress={() => play(item, featured)} />
              )}
            />
          </View>

          {isAuthenticated ? (
            <>
              {/* Your real Spotify playlists — /browse endpoints are gone, but /me/playlists still works */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Playlists</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={playlists}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
                  renderItem={({ item }) => (
                    <PlaylistCard
                      playlist={item}
                      onPress={() => navigation.navigate('Playlist', { playlistId: item.id, playlistName: item.name })}
                    />
                  )}
                />
              </View>

              {shufflePicks.length > 0 && (
                /* Shuffle's own guess, not Spotify's — see README section 11 for why
                   "New Releases"/"Recommended For You" can't be the real thing anymore. */
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Shuffle Picks</Text>
                  <Text style={styles.sectionSub}>Our own guess, based on artists you already listen to — not Spotify's recommendations.</Text>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={shufflePicks}
                    keyExtractor={(t) => t.id}
                    contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
                    renderItem={({ item }) => (
                      <TrackCard track={item} onPress={() => play(item, shufflePicks)} />
                    )}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              {/* New releases — Audius stand-in only; Spotify's own /browse/new-releases is gone (Feb 2026) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>New Releases</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={newReleases}
                  keyExtractor={(t) => t.id}
                  contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
                  renderItem={({ item }) => (
                    <TrackCard track={item} onPress={() => play(item, newReleases)} />
                  )}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended For You</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recommended}
                  keyExtractor={(t) => t.id}
                  contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
                  renderItem={({ item }) => (
                    <TrackCard track={item} onPress={() => play(item, recommended)} />
                  )}
                />
              </View>
            </>
          )}
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
  sectionSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  card: { width: 140 },
  cardArt: { width: 140, height: 140, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceHighlight },
  cardArtFallback: { backgroundColor: Colors.surfaceHighlight },
  cardTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500', marginTop: Spacing.sm },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
});
