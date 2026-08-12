import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserPlaylists, getUserSavedAudiobooks, getUserSavedShows, SpotifyAudiobook, SpotifyPlaylist, SpotifyShow } from '../api/spotify';
import { useAuthStore } from '../state/authStore';
import { usePlayerStore } from '../state/playerStore';
import { useUIStore } from '../state/uiStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterType = 'Playlists' | 'Podcasts' | 'Albums' | 'Artists' | 'Audiobooks' | 'Downloaded';
const FILTERS: FilterType[] = ['Playlists', 'Podcasts', 'Albums', 'Artists', 'Audiobooks', 'Downloaded'];

// Spotify's DELETE /playlists/{id}/followers (the only endpoint that ever handled
// deleting/unfollowing a playlist) was removed for Development Mode apps in Feb 2026 —
// there is no way to really delete a playlist via the API anymore. This just hides it
// from Shuffle's own list; it still exists on the real account. See README section 7.
const HIDDEN_STORAGE_KEY = 'shuffle_hidden_playlists_v1';

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const likedCount = usePlayerStore((s) => Object.keys(s.likedTracks).length);
  const { isAuthenticated, getValidToken } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('Playlists');
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [shows, setShows] = useState<SpotifyShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [audiobooks, setAudiobooks] = useState<SpotifyAudiobook[]>([]);
  const [audiobooksLoading, setAudiobooksLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const openCreatePlaylistModal = useUIStore((s) => s.openCreatePlaylistModal);
  // Select the raw records (stable reference between renders unless actually
  // changed) and derive arrays in the render body — Object.values() *inside*
  // a selector returns a new array every render, which breaks Zustand's
  // snapshot comparison and causes an infinite re-render loop.
  const savedAlbumsMap = usePlayerStore((s) => s.savedAlbums);
  const followedArtistsMap = usePlayerStore((s) => s.followedArtists);
  const savedAlbums = useMemo(() => Object.values(savedAlbumsMap), [savedAlbumsMap]);
  const followedArtists = useMemo(() => Object.values(followedArtistsMap), [followedArtistsMap]);
  const insets = useSafeAreaInsets();

  const loadSpotifyPlaylists = useCallback(async () => {
    const token = await getValidToken();
    if (!token) { setLoading(false); return; }
    try {
      setSpotifyPlaylists(await getUserPlaylists(token));
    } finally {
      setLoading(false);
    }
  }, [getValidToken]);

  const loadShows = useCallback(async () => {
    const token = await getValidToken();
    if (!token) { setShowsLoading(false); return; }
    try {
      setShows(await getUserSavedShows(token));
    } catch (e) {
      console.error('getUserSavedShows error:', e);
    } finally {
      setShowsLoading(false);
    }
  }, [getValidToken]);

  const loadAudiobooks = useCallback(async () => {
    const token = await getValidToken();
    if (!token) { setAudiobooksLoading(false); return; }
    try {
      setAudiobooks(await getUserSavedAudiobooks(token));
    } catch (e) {
      console.error('getUserSavedAudiobooks error:', e);
    } finally {
      setAudiobooksLoading(false);
    }
  }, [getValidToken]);

  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_STORAGE_KEY).then((raw) => {
      if (raw) setHiddenIds(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      setShowsLoading(true);
      setAudiobooksLoading(true);
      loadSpotifyPlaylists();
      loadShows();
      loadAudiobooks();
    } else {
      setLoading(false);
      setShowsLoading(false);
      setAudiobooksLoading(false);
    }
  }, [isAuthenticated, loadSpotifyPlaylists, loadShows, loadAudiobooks]);

  // Refresh whenever this tab regains focus — catches playlists created from
  // the Create tab (or anywhere else) without needing a manual refresh.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) loadSpotifyPlaylists();
    }, [isAuthenticated, loadSpotifyPlaylists]),
  );

  const openCreateModal = () => {
    // Real Spotify requires an account to create a playlist too — free or Premium,
    // there's no anonymous playlist creation. Match that instead of faking one locally.
    if (!isAuthenticated) {
      Alert.alert('Log in required', 'Log in with Spotify to create a playlist.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }
    openCreatePlaylistModal();
  };

  const removeFromShuffle = (id: string) => {
    Alert.alert(
      'Remove from Shuffle',
      "This only hides it in Shuffle — Spotify no longer lets apps delete a playlist, so it'll stay on your real account.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const next = [...hiddenIds, id];
            setHiddenIds(next);
            AsyncStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(next));
          },
        },
      ],
    );
  };

  const visiblePlaylists = spotifyPlaylists.filter((p) => !hiddenIds.includes(p.id));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>A</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.heading}>Your Library</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={openCreateModal}>
            <Ionicons name="add" size={26} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <TouchableOpacity style={styles.sortBtn}>
          <Ionicons name="swap-vertical" size={16} color={Colors.text} />
          <Text style={styles.sortText}>Recents</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="list" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {filter === 'Playlists' && loading && (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      )}

      {filter === 'Playlists' && !loading && (
        <FlatList
          data={isAuthenticated ? visiblePlaylists : []}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            <TouchableOpacity style={styles.likedRow} onPress={() => navigation.navigate('LikedSongs')}>
              <View style={styles.likedIcon}>
                <Ionicons name="heart" size={22} color={Colors.text} />
              </View>
              <View>
                <Text style={styles.itemName}>Liked in Shuffle</Text>
                <Text style={styles.itemSub}>{likedCount} songs</Text>
              </View>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Playlist', { playlistId: item.id, playlistName: item.name })}
              onLongPress={() => removeFromShuffle(item.id)}
            >
              <View style={styles.playlistIcon}>
                <Ionicons name="musical-notes" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>Playlist · {item.trackCount} songs</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAuthenticated
                ? 'Create a playlist to get started.'
                : 'Log in with Spotify to see and create playlists — just like the real app, that needs an account.'}
            </Text>
          }
        />
      )}

      {filter === 'Podcasts' && showsLoading && (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      )}

      {filter === 'Podcasts' && !showsLoading && (
        <FlatList
          data={isAuthenticated ? shows : []}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Show', { showId: item.id, showName: item.name })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.showArt} />
              ) : (
                <View style={styles.playlistIcon}>
                  <Ionicons name="mic" size={20} color={Colors.textSecondary} />
                </View>
              )}
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.publisher}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAuthenticated
                ? 'Follow a show on Spotify and it will show up here.'
                : 'Log in with Spotify to see your saved shows.'}
            </Text>
          }
        />
      )}

      {filter === 'Albums' && (
        <FlatList
          data={isAuthenticated ? savedAlbums : []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Album', { albumId: item.id })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.showArt} />
              ) : (
                <View style={styles.playlistIcon}>
                  <Ionicons name="disc-outline" size={20} color={Colors.textSecondary} />
                </View>
              )}
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAuthenticated
                ? 'Save an album (the heart on an album page) and it will show up here.'
                : 'Log in with Spotify to see your saved albums.'}
            </Text>
          }
        />
      )}

      {filter === 'Artists' && (
        <FlatList
          data={isAuthenticated ? followedArtists : []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Artist', { artistId: item.id, artistName: item.name })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.artistArt} />
              ) : (
                <View style={styles.playlistIcon}>
                  <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
                </View>
              )}
              <Text style={styles.itemName}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAuthenticated
                ? 'Follow an artist and they will show up here.'
                : 'Log in with Spotify to see who you follow.'}
            </Text>
          }
        />
      )}

      {filter === 'Audiobooks' && audiobooksLoading && (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      )}

      {filter === 'Audiobooks' && !audiobooksLoading && (
        <FlatList
          data={isAuthenticated ? audiobooks : []}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Audiobook', { audiobookId: item.id, audiobookName: item.name })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.showArt} />
              ) : (
                <View style={styles.playlistIcon}>
                  <Ionicons name="book-outline" size={20} color={Colors.textSecondary} />
                </View>
              )}
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.author}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAuthenticated
                ? 'Save an audiobook on Spotify and it will show up here.'
                : 'Log in with Spotify to see your saved audiobooks.'}
            </Text>
          }
        />
      )}

      {filter === 'Downloaded' && (
        <View style={styles.center}>
          <Text style={styles.empty}>No downloads saved yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  heading: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  iconBtn: { padding: Spacing.sm },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sortText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },
  filters: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md, alignItems: 'flex-start' },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceHighlight,
  },
  pillActive: { backgroundColor: Colors.text },
  pillText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  pillTextActive: { color: Colors.background },
  likedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  likedIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#4b0082',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  playlistIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showArt: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceHighlight,
  },
  artistArt: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceHighlight,
  },
  itemName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  itemSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
});
