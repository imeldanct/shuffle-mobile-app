import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { Playlist } from '../types';

// Simple local playlist store (no persistence for MVP — can add AsyncStorage later)
let nextId = 1;

export default function LibraryScreen() {
  const { likedIds, queue, currentTrack } = usePlayerStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const createPlaylist = () => {
    const name = newName.trim();
    if (!name) return;
    setPlaylists((prev) => [
      ...prev,
      { id: String(nextId++), name, trackIds: [], createdAt: Date.now() },
    ]);
    setNewName('');
    setModalVisible(false);
  };

  const deletePlaylist = (id: string) => {
    Alert.alert('Delete playlist', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setPlaylists((prev) => prev.filter((p) => p.id !== id)),
      },
    ]);
  };

  const likedCount = likedIds.size;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Library</Text>

      {/* Liked Songs */}
      <View style={styles.likedRow}>
        <View style={styles.likedIcon}>
          <Ionicons name="heart" size={24} color={Colors.primary} />
        </View>
        <View style={styles.likedInfo}>
          <Text style={styles.likedTitle}>Liked Songs</Text>
          <Text style={styles.likedCount}>{likedCount} song{likedCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Playlists */}
      <View style={styles.playlistHeader}>
        <Text style={styles.subheading}>Playlists</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.playlistRow}
            onLongPress={() => deletePlaylist(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.playlistIcon}>
              <Ionicons name="musical-notes" size={22} color={Colors.textSecondary} />
            </View>
            <View style={styles.playlistInfo}>
              <Text style={styles.playlistName}>{item.name}</Text>
              <Text style={styles.playlistCount}>
                {item.trackIds.length} song{item.trackIds.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No playlists yet. Tap + to create one.</Text>
        }
      />

      {/* Create playlist modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setNewName(''); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createPlaylist}>
                <Text style={styles.modalCreate}>Create</Text>
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
  heading: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  likedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  likedIcon: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#2d0e4d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedInfo: { marginLeft: Spacing.md },
  likedTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  likedCount: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  subheading: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playlistIcon: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: { marginLeft: Spacing.md },
  playlistName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  playlistCount: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '80%',
  },
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
  modalCreate: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
});
