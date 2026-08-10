import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAudiobook, getAudiobookChapters, SpotifyAudiobook } from '../api/spotify';
import TrackItem from '../components/TrackItem';
import { useAuthStore } from '../state/authStore';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { Track } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Audiobook'>;

export default function AudiobookScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const [audiobook, setAudiobook] = useState<SpotifyAudiobook | null>(null);
  const [chapters, setChapters] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { getValidToken } = useAuthStore();
  const { currentTrack, playSpotifyTrack } = usePlayerStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) { setLoading(false); return; }
      try {
        const bookData = await getAudiobook(token, route.params.audiobookId);
        const bookChapters = await getAudiobookChapters(token, route.params.audiobookId, bookData.name);
        if (!cancelled) {
          setAudiobook(bookData);
          setChapters(bookChapters);
        }
      } catch (e) {
        console.error('AudiobookScreen load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [route.params.audiobookId, getValidToken]);

  const handlePress = useCallback(async (chapter: Track) => {
    await playSpotifyTrack(chapter, chapters);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Playback unavailable', err);
  }, [chapters, playSpotifyTrack]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={28} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        {audiobook?.imageUrl ? (
          <Image source={{ uri: audiobook.imageUrl }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artFallback]} />
        )}
        <Text style={styles.title} numberOfLines={2}>{audiobook?.name ?? route.params.audiobookName ?? 'Audiobook'}</Text>
        <Text style={styles.sub}>{audiobook?.author}</Text>
        <Text style={styles.subMuted}>{chapters.length} chapters</Text>
      </View>

      {chapters.length === 0 ? (
        <Text style={styles.empty}>This audiobook has no chapters.</Text>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackItem track={item} onPress={handlePress} isActive={currentTrack?.id === item.id} />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  back: { padding: Spacing.md },
  header: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: 4 },
  art: { width: 160, height: 160, borderRadius: BorderRadius.md, marginBottom: Spacing.md, backgroundColor: Colors.surfaceHighlight },
  artFallback: { backgroundColor: Colors.surfaceHighlight },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.md },
  subMuted: { color: Colors.textMuted, fontSize: FontSize.sm },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
});
