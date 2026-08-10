import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  followArtist,
  getArtist,
  getArtistAlbums,
  getArtistPopularTracks,
  isFollowingArtist,
  SpotifyArtist,
  SpotifyAlbum,
  unfollowArtist,
} from '../api/spotify';
import TrackItem from '../components/TrackItem';
import { useAuthStore } from '../state/authStore';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { Track } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Artist'>;

function AlbumCard({ album, onPress }: { album: SpotifyAlbum; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.7}>
      {album.imageUrl ? (
        <Image source={{ uri: album.imageUrl }} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.albumArtFallback]} />
      )}
      <Text style={styles.albumTitle} numberOfLines={2}>{album.name}</Text>
      <Text style={styles.albumSub} numberOfLines={1}>{album.releaseDate?.slice(0, 4) ?? ''}</Text>
    </TouchableOpacity>
  );
}

export default function ArtistScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [popular, setPopular] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getValidToken } = useAuthStore();
  const { currentTrack, playSpotifyTrack, likedTracks, setFollowedArtistLocally } = usePlayerStore();

  const likedByThisArtist = Object.values(likedTracks).filter((t) => t.artistId === route.params.artistId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) { setLoading(false); return; }
      try {
        const [artistData, popularTracks, artistAlbums, isFollowing] = await Promise.all([
          getArtist(token, route.params.artistId),
          getArtistPopularTracks(token, route.params.artistName, 10),
          getArtistAlbums(token, route.params.artistId, 10),
          isFollowingArtist(token, route.params.artistId).catch(() => false),
        ]);
        if (!cancelled) {
          setArtist(artistData);
          setPopular(popularTracks);
          setAlbums(artistAlbums);
          setFollowing(isFollowing);
        }
      } catch (e) {
        console.error('ArtistScreen load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [route.params.artistId, route.params.artistName, getValidToken]);

  const handlePress = useCallback(async (track: Track) => {
    await playSpotifyTrack(track, popular);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Playback unavailable', err);
  }, [popular, playSpotifyTrack]);

  const toggleFollow = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    setFollowLoading(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) await unfollowArtist(token, route.params.artistId);
      else await followArtist(token, route.params.artistId);
      // Mirror into "Followed in Shuffle" — Spotify's GET /me/following (list)
      // was removed in Feb 2026, so this is the only way to list them again later.
      await setFollowedArtistLocally(
        { id: route.params.artistId, name: artist?.name ?? route.params.artistName, imageUrl: artist?.imageUrl ?? null },
        !wasFollowing,
      );
    } catch (e) {
      console.error('toggleFollow error:', e);
      setFollowing(wasFollowing);
      Alert.alert('Could not update follow status', 'Try again in a moment.');
    } finally {
      setFollowLoading(false);
    }
  }, [following, route.params.artistId, route.params.artistName, artist, getValidToken, setFollowedArtistLocally]);

  const playPopular = useCallback(() => {
    if (popular.length) handlePress(popular[0]);
  }, [popular, handlePress]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
      {artist?.imageUrl ? (
        <ImageBackground source={{ uri: artist.imageUrl }} style={styles.hero}>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.heroGradient} />
          <TouchableOpacity style={[styles.back, { marginTop: insets.top }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.name}>{artist?.name ?? route.params.artistName}</Text>
        </ImageBackground>
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <TouchableOpacity style={[styles.back, { marginTop: insets.top }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.name}>{artist?.name ?? route.params.artistName}</Text>
        </View>
      )}

      <View style={styles.metaRow}>
        {!!artist?.followers && (
          <Text style={styles.sub}>{artist.followers.toLocaleString()} monthly listeners</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.followBtn, following && styles.followingBtn]}
          onPress={toggleFollow}
          disabled={followLoading}
        >
          <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
        {popular.length > 0 && (
          <TouchableOpacity style={styles.playBtn} onPress={playPopular} activeOpacity={0.8}>
            <Ionicons name="play" size={24} color={Colors.background} />
          </TouchableOpacity>
        )}
      </View>

      {likedByThisArtist.length > 0 && (
        <TouchableOpacity
          style={styles.likedRow}
          onPress={() => navigation.navigate('LikedSongs')}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={20} color={Colors.primary} />
          <Text style={styles.likedText}>
            You liked {likedByThisArtist.length} song{likedByThisArtist.length === 1 ? '' : 's'} from this artist
          </Text>
        </TouchableOpacity>
      )}

      {popular.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular</Text>
          {popular.map((t) => (
            <TrackItem key={t.id} track={t} onPress={handlePress} isActive={currentTrack?.id === t.id} />
          ))}
        </View>
      )}

      {albums.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Albums</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={albums}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}
            renderItem={({ item }) => (
              <AlbumCard album={item} onPress={() => navigation.navigate('Album', { albumId: item.id })} />
            )}
          />
        </View>
      )}

      {popular.length === 0 && albums.length === 0 && (
        <Text style={styles.empty}>Nothing to show for this artist yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  back: { padding: Spacing.md, alignSelf: 'flex-start' },
  hero: { width: '100%', height: 280, justifyContent: 'space-between' },
  heroFallback: { backgroundColor: Colors.surfaceHighlight },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  name: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  metaRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  followBtn: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  followingBtn: { borderColor: Colors.text },
  followBtnText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  followingBtnText: { color: Colors.text },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  likedText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  albumCard: { width: 140 },
  albumArt: { width: 140, height: 140, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceHighlight },
  albumArtFallback: { backgroundColor: Colors.surfaceHighlight },
  albumTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500', marginTop: Spacing.sm },
  albumSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl },
});
