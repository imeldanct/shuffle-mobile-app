import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { usePlayerStore } from '../state/playerStore';
import { useUIStore } from '../state/uiStore';
import { Colors, BorderRadius, FontSize, Spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const trackWidthRef = useRef(0);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const openTrackActions = useUIStore((s) => s.openTrackActions);

  const volumeWidthRef = useRef(0);

  const {
    mode, currentTrack, isPlaying, isLoading, positionMs, durationMs,
    repeat, isShuffle, togglePlay, seekTo, skipNext, skipPrev,
    setRepeat, toggleShuffle, toggleLike, isLiked,
    availableDevices, remoteDeviceId, refreshDevices, switchDevice,
    volume, setVolume,
  } = usePlayerStore();

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  const openDevicePicker = useCallback(async () => {
    if (mode !== 'remote') {
      Alert.alert('No devices to show', 'Device switching is only available while playing through Spotify Connect.');
      return;
    }
    await refreshDevices();
    setDeviceModalVisible(true);
  }, [mode, refreshDevices]);

  const handleSelectDevice = useCallback(async (deviceId: string) => {
    setDeviceModalVisible(false);
    await switchDevice(deviceId);
    const err = usePlayerStore.getState().remoteError;
    if (err) Alert.alert('Playback unavailable', err);
  }, [switchDevice]);

  const handleVolumeDrag = useCallback((e: any) => {
    if (volumeWidthRef.current > 0) {
      const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / volumeWidthRef.current));
      setVolume(ratio * 100);
    }
  }, [setVolume]);

  const handleShare = useCallback(async () => {
    if (!currentTrack) return;
    const url = currentTrack.spotifyUri
      ? `https://open.spotify.com/track/${currentTrack.spotifyUri.split(':').pop()}`
      : null;
    try {
      await Share.share({
        message: url ? `${currentTrack.title} — ${currentTrack.artist}\n${url}` : `${currentTrack.title} — ${currentTrack.artist}`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  }, [currentTrack]);

  const cycleRepeat = useCallback(() => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  }, [repeat, setRepeat]);

  const handleSeek = useCallback((e: any) => {
    if (durationMs > 0 && trackWidthRef.current > 0) {
      const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidthRef.current));
      seekTo(ratio * durationMs);
    }
  }, [durationMs, seekTo]);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const remaining = Math.max(0, durationMs - positionMs);

  if (!currentTrack) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing playing yet.</Text>
        <Text style={styles.emptyHint}>Pick a track from Home or Search.</Text>
      </View>
    );
  }

  const content = (
    <View style={[styles.inner, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom || Spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-down" size={28} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => currentTrack && openTrackActions(currentTrack)}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Large artwork */}
      <View style={styles.artworkWrap}>
        {currentTrack.artworkUrl ? (
          <Image source={{ uri: currentTrack.artworkUrl }} style={styles.artwork} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.artworkFallback]} />
        )}
      </View>

      {/* Track info + heart */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          {currentTrack.source === 'spotify' && currentTrack.artistId ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Artist', {
                artistId: currentTrack.artistId,
                artistName: currentTrack.artist,
              })}
            >
              <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(currentTrack)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Progress bar — tap or drag to seek */}
      <View style={styles.progressWrap}>
        <View
          style={styles.progressTouchable}
          onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleSeek}
          onResponderMove={handleSeek}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            <View style={[styles.progressThumb, { left: `${progress * 100}%` as any }]} />
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatMs(positionMs)}</Text>
          <Text style={styles.time}>-{formatMs(remaining)}</Text>
        </View>
      </View>

      {/* Playback controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={24} color={isShuffle ? Colors.primary : Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={32} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          {isLoading
            ? <ActivityIndicator color={Colors.background} size="large" />
            : <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={Colors.background} />
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={32} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat}>
          <Ionicons
            name={repeat === 'one' ? 'repeat-outline' : 'repeat'}
            size={24}
            color={repeat !== 'off' ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Utility row */}
      <View style={styles.utilRow}>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={openDevicePicker}>
          <Ionicons name="phone-portrait-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => navigation.navigate('Queue')}
        >
          <Ionicons name="list" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const deviceModal = (
    <Modal visible={deviceModalVisible} transparent animationType="fade" onRequestClose={() => setDeviceModalVisible(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDeviceModalVisible(false)}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Connect to a device</Text>

          <View style={styles.volumeRow}>
            <Ionicons name="volume-low-outline" size={18} color={Colors.textSecondary} />
            <View
              style={styles.volumeTrack}
              onLayout={(e) => { volumeWidthRef.current = e.nativeEvent.layout.width; }}
              onStartShouldSetResponder={() => true}
              onResponderGrant={handleVolumeDrag}
              onResponderMove={handleVolumeDrag}
            >
              <View style={styles.volumeTrackBg} />
              <View style={[styles.volumeFill, { width: `${volume}%` as any }]} />
            </View>
            <Ionicons name="volume-high-outline" size={18} color={Colors.textSecondary} />
          </View>

          {availableDevices.length === 0 ? (
            <Text style={styles.modalEmpty}>No devices found. Open Spotify somewhere first.</Text>
          ) : (
            <FlatList
              data={availableDevices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.deviceRow} onPress={() => handleSelectDevice(item.id)}>
                  <Ionicons
                    name={item.type === 'Computer' ? 'desktop-outline' : item.type === 'Speaker' ? 'volume-high-outline' : 'phone-portrait-outline'}
                    size={22}
                    color={Colors.text}
                  />
                  <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
                  {item.id === remoteDeviceId && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (currentTrack.artworkUrl) {
    return (
      <>
        <ImageBackground source={{ uri: currentTrack.artworkUrl }} style={styles.bg} blurRadius={80}>
          <View style={styles.overlay}>{content}</View>
        </ImageBackground>
        {deviceModal}
      </>
    );
  }

  return (
    <>
      <View style={[styles.bg, { backgroundColor: '#0a0a0a' }]}>{content}</View>
      {deviceModal}
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  inner: { flex: 1, paddingHorizontal: Spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  emptyText: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
  emptyHint: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  artworkWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md },
  artwork: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  artworkFallback: { backgroundColor: Colors.surfaceHighlight },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  infoText: { flex: 1, marginRight: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  artist: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: 4 },

  progressWrap: { marginBottom: Spacing.md },
  progressTouchable: { paddingVertical: Spacing.sm },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: Colors.text, borderRadius: 2 },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.text,
    marginLeft: -7,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  time: { color: Colors.textMuted, fontSize: FontSize.xs },

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },

  utilRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.xl,
    maxHeight: '60%',
  },
  modalTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  volumeTrack: { flex: 1, height: 24, justifyContent: 'center' },
  volumeTrackBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  volumeFill: { position: 'absolute', height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  modalEmpty: { color: Colors.textSecondary, fontSize: FontSize.sm },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  deviceName: { flex: 1, color: Colors.text, fontSize: FontSize.md },
});
