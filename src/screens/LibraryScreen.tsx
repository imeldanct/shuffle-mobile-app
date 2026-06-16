import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../state/playerStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';
import { Playlist } from '../types';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterType = 'Playlists' | 'Podcasts' | 'Albums' | 'Artists' | 'Downloaded';
const FILTERS: FilterType[] = ['Playlists', 'Podcasts', 'Albums', 'Artists', 'Downloaded'];

let nextId = 1;

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const likedIds = usePlayerStore((s) => s.likedIds);
  const [filter, setFilter] = useState<FilterType>('Playlists');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const insets = useSafeAreaInsets();

  const createPlaylist = () => {
    const name = newName.trim();
    if (!name) return;
    setPlaylists((prev) => [...prev, { id: String(nextId++), name, trackIds: [], createdAt: Date.now() }]);
    setNewName('');
    setModalVisible(false);
  };

  const deletePlaylist = (id: string) => {
    Alert.alert('Delete playlist', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setPlaylists((p) => p.filter((x) => x.id !== id)) },
    ]);
  };

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
          <TouchableOpacity style={styles.iconBtn} onPress={() => setModalVisible(true)}>
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
      {filter === 'Playlists' && (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            <TouchableOpacity style={styles.likedRow} onPress={() => navigation.navigate('LikedSongs')}>
              <View style={styles.likedIcon}>
                <Ionicons name="heart" size={22} color={Colors.text} />
              </View>
              <View>
                <Text style={styles.itemName}>Liked Songs</Text>
                <Text style={styles.itemSub}>{likedIds.size} songs</Text>
              </View>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              onLongPress={() => deletePlaylist(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.playlistIcon}>
                <Ionicons name="musical-notes" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>Playlist · {item.trackIds.length} songs</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Create a playlist to get started.</Text>
          }
        />
      )}

      {filter !== 'Playlists' && (
        <View style={styles.center}>
          <Text style={styles.empty}>No {filter.toLowerCase()} saved yet.</Text>
        </View>
      )}

      {/* Create playlist modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Give your playlist a name"
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
  itemName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  itemSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
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
  modalCreate: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
});
