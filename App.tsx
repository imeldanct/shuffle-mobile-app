import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MiniPlayer from './src/components/MiniPlayer';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import SearchScreen from './src/screens/SearchScreen';
import { usePlayerStore } from './src/state/playerStore';
import { Colors } from './src/theme';

export type RootTabParamList = {
  Home: undefined;
  Search: undefined;
  NowPlaying: undefined;
  Library: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

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

export default function App() {
  const { currentTrack } = usePlayerStore();
  const navigationRef = useRef<any>(null);

  const goToNowPlaying = () => {
    navigationRef.current?.navigate('NowPlaying');
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef} theme={shuffleTheme}>
        <View style={styles.root}>
          <Tab.Navigator
            tabBar={(props) => (
              <View>
                {currentTrack && <MiniPlayer onPress={goToNowPlaying} />}
                <BottomTabBar {...props} />
              </View>
            )}
            screenOptions={({ route }) => ({
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.text,
              tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
              tabBarActiveTintColor: Colors.primary,
              tabBarInactiveTintColor: Colors.textSecondary,
              tabBarIcon: ({ color, size }) => {
                const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                  Home: 'home',
                  Search: 'search',
                  NowPlaying: 'musical-note',
                  Library: 'library',
                };
                return <Ionicons name={icons[route.name]} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
            <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
            <Tab.Screen name="NowPlaying" component={NowPlayingScreen} options={{ title: 'Now Playing' }} />
            <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Library' }} />
          </Tab.Navigator>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
