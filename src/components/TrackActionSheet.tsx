import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Alert, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { usePlayerStore } from '../state/playerStore';
import { useUIStore } from '../state/uiStore';
import { Colors, FontSize, Spacing, BorderRadius } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Real Spotify's track menu has ~13 items. Only these 6 are things any
// third-party app can actually do — the rest (Jam, radio, taste-profile
// exclusion, SongDNA, concerts, song credits) have no public API at all.
// See README section 11 for the full breakdown.
export default function TrackActionSheet() {
  const navigation = useNavigation<Nav>();
  const { actionSheetTrack, closeTrackActions } = useUIStore();
  const openAddToPlaylist = useUIStore((s) => s.openAddToPlaylist);
  const openSpotifyCode = useUIStore((s) => s.openSpotifyCode);
  const { addToQueue } = usePlayerStore();
  const track = actionSheetTrack;

  const isSpotify = track?.source === 'spotify';

  const handleAddToPlaylist = useCallback(() => {
    if (!track) return;
    closeTrackActions();
    if (!isSpotify) {
      Alert.alert('Not available', 'Only real Spotify tracks can be added to a playlist.');
      return;
    }
    openAddToPlaylist(track);
  }, [track, isSpotify, closeTrackActions, openAddToPlaylist]);

  const handleAddToQueue = useCallback(async () => {
    if (!track) return;
    closeTrackActions();
    await addToQueue(track);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Could not add to queue', err);
  }, [track, closeTrackActions, addToQueue]);

  const handleGoToQueue = useCallback(() => {
    closeTrackActions();
    navigation.navigate('Queue');
  }, [closeTrackActions, navigation]);

  const handleGoToAlbum = useCallback(() => {
    if (!track?.albumId) {
      closeTrackActions();
      Alert.alert('Not available', "This track isn't linked to an album.");
      return;
    }
    closeTrackActions();
    navigation.navigate('Album', { albumId: track.albumId });
  }, [track, closeTrackActions, navigation]);

  const handleGoToArtist = useCallback(() => {
    if (!track || !isSpotify || !track.artistId) {
      closeTrackActions();
      Alert.alert('Not available', "This track isn't linked to a Spotify artist.");
      return;
    }
    closeTrackActions();
    navigation.navigate('Artist', { artistId: track.artistId, artistName: track.artist });
  }, [track, isSpotify, closeTrackActions, navigation]);

  const handleShare = useCallback(async () => {
    if (!track) return;
    closeTrackActions();
    const url = track.spotifyUri
      ? `https://open.spotify.com/track/${track.spotifyUri.split(':').pop()}`
      : null;
    try {
      await Share.share({ message: url ? `${track.title} — ${track.artist}\n${url}` : `${track.title} — ${track.artist}` });
    } catch (e) {
      console.error('Share error:', e);
    }
  }, [track, closeTrackActions]);

  const handleShowCode = useCallback(() => {
    if (!track) return;
    closeTrackActions();
    if (!isSpotify) {
      Alert.alert('Not available', 'Spotify Codes only exist for real Spotify tracks.');
      return;
    }
    openSpotifyCode(track);
  }, [track, isSpotify, closeTrackActions, openSpotifyCode]);

  const items = [
    { label: 'Add to Playlist', icon: 'add-circle-outline' as const, onPress: handleAddToPlaylist },
    { label: 'Add to Queue', icon: 'list-outline' as const, onPress: handleAddToQueue },
    { label: 'Go to Queue', icon: 'reorder-three-outline' as const, onPress: handleGoToQueue },
    { label: 'Go to Album', icon: 'disc-outline' as const, onPress: handleGoToAlbum },
    { label: 'Go to Artist', icon: 'person-outline' as const, onPress: handleGoToArtist },
    { label: 'Share', icon: 'share-outline' as const, onPress: handleShare },
    { label: 'Show Spotify Code', icon: 'qr-code-outline' as const, onPress: handleShowCode },
  ];

  return (
    <Modal visible={!!track} transparent animationType="fade" onRequestClose={closeTrackActions}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeTrackActions}>
        <View style={styles.box}>
          {track && (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.sub} numberOfLines={1}>{track.artist}</Text>
            </View>
          )}
          {items.map((item) => (
            <TouchableOpacity key={item.label} style={styles.row} onPress={item.onPress}>
              <Ionicons name={item.icon} size={22} color={Colors.text} />
              <Text style={styles.rowText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: { paddingBottom: Spacing.md, marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  rowText: { color: Colors.text, fontSize: FontSize.md },
});
