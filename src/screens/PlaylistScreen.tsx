import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlaylistTracks, removeTrackFromPlaylist, updatePlaylistDetails } from '../api/spotify';
import TrackItem from '../components/TrackItem';
import { useAuthStore } from '../state/authStore';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { Track } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Playlist'>;

export default function PlaylistScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(route.params.playlistName ?? 'Playlist');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(name);
  const { getValidToken } = useAuthStore();
  const { currentTrack, playSpotifyTrack } = usePlayerStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) { setLoading(false); return; }
      try {
        const result = await getPlaylistTracks(token, route.params.playlistId);
        if (!cancelled) setTracks(result);
      } catch (e) {
        console.error('getPlaylistTracks error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [route.params.playlistId, getValidToken]);

  const handlePress = useCallback(async (track: Track) => {
    await playSpotifyTrack(track, tracks);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Playback unavailable', err);
  }, [tracks, playSpotifyTrack]);

  const playAll = useCallback(() => {
    if (tracks.length) handlePress(tracks[0]);
  }, [tracks, handlePress]);

  const handleRemove = useCallback((track: Track) => {
    if (!track.spotifyUri) return;
    Alert.alert('Remove from playlist', `Remove "${track.title}" from this playlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const token = await getValidToken();
          if (!token) return;
          try {
            await removeTrackFromPlaylist(token, route.params.playlistId, track.spotifyUri!);
            setTracks((prev) => prev.filter((t) => t.id !== track.id));
          } catch (e) {
            console.error('removeTrackFromPlaylist error:', e);
            Alert.alert('Could not remove track', 'Try again in a moment.');
          }
        },
      },
    ]);
  }, [route.params.playlistId, getValidToken]);

  const openEditModal = useCallback(() => {
    setEditName(name);
    setEditModalVisible(true);
  }, [name]);

  const handleSaveName = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      await updatePlaylistDetails(token, route.params.playlistId, { name: trimmed });
      setName(trimmed);
      setEditModalVisible(false);
    } catch (e) {
      console.error('updatePlaylistDetails error:', e);
      Alert.alert('Could not rename playlist', 'Try again in a moment.');
    }
  }, [editName, route.params.playlistId, getValidToken]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.back} onPress={openEditModal}>
          <Ionicons name="pencil" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        {!loading && (
          <Text style={styles.sub}>{tracks.length} songs</Text>
        )}
      </View>

      {!loading && tracks.length > 0 && (
        <TouchableOpacity style={styles.playBtn} onPress={playAll} activeOpacity={0.8}>
          <Ionicons name="play" size={22} color={Colors.background} />
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>This playlist has no tracks.</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={handlePress}
              onLongPress={handleRemove}
              isActive={currentTrack?.id === item.id}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        />
      )}

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Playlist</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveName}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { padding: Spacing.md },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: Spacing.sm },
  playBtn: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.xl,
    marginBottom: Spacing.md,
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, width: '80%' },
  modalTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  modalInput: {
    backgroundColor: Colors.surfaceHighlight,
    color: Colors.text,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  modalCancel: { color: Colors.textSecondary, fontSize: FontSize.md },
  modalSave: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
});
