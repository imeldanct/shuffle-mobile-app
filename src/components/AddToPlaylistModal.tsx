import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { addTrackToPlaylist, getUserPlaylists, SpotifyPlaylist } from '../api/spotify';
import { useAuthStore } from '../state/authStore';
import { useUIStore } from '../state/uiStore';
import { Colors, FontSize, Spacing, BorderRadius } from '../theme';

export default function AddToPlaylistModal() {
  const { addToPlaylistTrack, closeAddToPlaylist } = useUIStore();
  const { getValidToken } = useAuthStore();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const visible = !!addToPlaylistTrack;

  useEffect(() => {
    if (!addToPlaylistTrack) return;
    (async () => {
      setLoading(true);
      const token = await getValidToken();
      if (!token) { setLoading(false); return; }
      try {
        setPlaylists(await getUserPlaylists(token));
      } catch (e) {
        console.error('getUserPlaylists error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [addToPlaylistTrack, getValidToken]);

  const handleSelect = async (playlistId: string, playlistName: string) => {
    const track = addToPlaylistTrack;
    closeAddToPlaylist();
    if (!track?.spotifyUri) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      await addTrackToPlaylist(token, playlistId, track.spotifyUri);
      Alert.alert('Added', `Added to ${playlistName}.`);
    } catch (e) {
      console.error('addTrackToPlaylist error:', e);
      Alert.alert('Could not add track', 'Try again in a moment.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAddToPlaylist}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeAddToPlaylist}>
        <View style={styles.box}>
          <Text style={styles.title}>Add to playlist</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : playlists.length === 0 ? (
            <Text style={styles.empty}>No playlists yet — create one in Library first.</Text>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => handleSelect(item.id, item.name)}>
                  <Ionicons name="musical-notes" size={20} color={Colors.textSecondary} />
                  <Text style={styles.rowText} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  box: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.xl,
    maxHeight: '60%',
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  empty: { color: Colors.textSecondary, fontSize: FontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  rowText: { flex: 1, color: Colors.text, fontSize: FontSize.md },
});
