import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createPlaylist as createSpotifyPlaylist } from '../api/spotify';
import { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../state/authStore';
import { useUIStore } from '../state/uiStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CreatePlaylistModal() {
  const navigation = useNavigation<Nav>();
  const { getValidToken } = useAuthStore();
  const { createPlaylistModalVisible, closeCreatePlaylistModal } = useUIStore();
  const [name, setName] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      const playlist = await createSpotifyPlaylist(token, trimmed);
      setName('');
      closeCreatePlaylistModal();
      navigation.navigate('Playlist', { playlistId: playlist.id, playlistName: playlist.name });
    } catch (e) {
      console.error('createPlaylist error:', e);
      Alert.alert('Could not create playlist', 'Try again in a moment.');
    }
  };

  return (
    <Modal visible={createPlaylistModalVisible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>New Playlist</Text>
          <TextInput
            style={styles.input}
            placeholder="Give your playlist a name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <View style={styles.btns}>
            <TouchableOpacity onPress={() => { closeCreatePlaylistModal(); setName(''); }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate}>
              <Text style={styles.create}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  box: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, width: '80%' },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceHighlight,
    color: Colors.text,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  btns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  cancel: { color: Colors.textSecondary, fontSize: FontSize.md },
  create: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
});
