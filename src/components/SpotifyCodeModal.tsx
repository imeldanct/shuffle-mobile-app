import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSpotifyCodeImageUrl } from '../api/spotify';
import { useUIStore } from '../state/uiStore';
import { Colors, FontSize, Spacing, BorderRadius } from '../theme';

export default function SpotifyCodeModal() {
  const { spotifyCodeTrack, closeSpotifyCode } = useUIStore();

  return (
    <Modal visible={!!spotifyCodeTrack} transparent animationType="fade" onRequestClose={closeSpotifyCode}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSpotifyCode}>
        <View style={styles.box}>
          {spotifyCodeTrack?.spotifyUri && (
            <Image
              source={{ uri: getSpotifyCodeImageUrl(spotifyCodeTrack.spotifyUri) }}
              style={styles.code}
              resizeMode="contain"
            />
          )}
          <Text style={styles.title} numberOfLines={1}>{spotifyCodeTrack?.title}</Text>
          <Text style={styles.sub}>Scan this in the real Spotify app to find the track.</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center' },
  box: {
    backgroundColor: '#121212',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '85%',
    alignItems: 'center',
  },
  code: { width: '100%', height: 120, marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: Spacing.xs, textAlign: 'center' },
});
