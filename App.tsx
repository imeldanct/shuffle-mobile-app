import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MiniPlayer from './src/components/MiniPlayer';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import ArtistScreen from './src/screens/ArtistScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import PlaylistScreen from './src/screens/PlaylistScreen';
import LikedSongsScreen from './src/screens/LikedSongsScreen';
import QueueScreen from './src/screens/QueueScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import { useEffect } from 'react';
import { usePlayerStore } from './src/state/playerStore';
import { useAuthStore } from './src/state/authStore';
import { Colors } from './src/theme';
import { RootStackParamList, TabParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const shuffleTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.primary,
    notification: Colors.primary,
  },
};

function Tabs() {
  const { currentTrack } = usePlayerStore();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View>
          {currentTrack && (
            <MiniPlayer />
          )}
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
            Home: { active: 'home', inactive: 'home-outline' },
            Search: { active: 'search', inactive: 'search-outline' },
            Library: { active: 'library', inactive: 'library-outline' },
          };
          const icon = icons[route.name];
          return <Ionicons name={focused ? icon.active : icon.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Your Library' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  useEffect(() => { loadFromStorage(); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={shuffleTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Main tabs */}
          <Stack.Screen name="Main" component={Tabs} />

          {/* Full-screen modal — slides up from mini-player */}
          <Stack.Screen
            name="NowPlaying"
            component={NowPlayingScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />

          {/* Stack screens — push over the tabs */}
          <Stack.Screen name="Artist" component={ArtistScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Album" component={AlbumScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Playlist" component={PlaylistScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="LikedSongs" component={LikedSongsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Queue" component={QueueScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
