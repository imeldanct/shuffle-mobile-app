import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackItem from '../components/TrackItem';
import { usePlayerStore } from '../state/playerStore';
import { Colors, FontSize, Spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function QueueScreen() {
  const navigation = useNavigation<Nav>();
  const { queue, queueIndex, currentTrack, playTrack } = usePlayerStore();
  const insets = useSafeAreaInsets();

  const upNext = queue.slice(queueIndex + 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Queue</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {currentTrack && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Now playing</Text>
          <TrackItem track={currentTrack} onPress={() => {}} isActive />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Next up</Text>
        {upNext.length === 0 ? (
          <Text style={styles.empty}>Nothing in the queue.</Text>
        ) : (
          <FlatList
            data={upNext}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <TrackItem
                track={item}
                onPress={(t) => playTrack(t, queue)}
              />
            )}
          />
        )}
      </View>
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
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, paddingHorizontal: Spacing.md },
});
