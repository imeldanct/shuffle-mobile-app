# Shuffle 🎵

A Spotify-inspired music streaming app built with React Native + Expo.  
Streams full-length, royalty-free tracks from the [Audius](https://audius.co) decentralised music platform — **no API key required**.

---

## Features

| Feature | Details |
|---|---|
| **Home / Trending** | Live trending tracks fetched from Audius on launch |
| **Search** | Debounced real-time track search (400 ms delay) |
| **Full audio playback** | Play, pause, seek, skip next/previous |
| **Repeat modes** | Off → Repeat All → Repeat One (cycles on tap) |
| **Shuffle** | Randomises playback order from the active queue |
| **Liked songs** | Heart any track; count shown in Library |
| **Playlists** | Create and name playlists; long-press to delete |
| **Mini-player** | Persistent bar above the tab bar; tapping opens Now Playing |
| **Now Playing screen** | Large artwork, progress bar, full controls, like button |
| **Dark theme** | Spotify-style dark palette throughout |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 51, blank-typescript template) |
| Language | TypeScript |
| Navigation | [React Navigation](https://reactnavigation.org) — bottom tabs |
| Audio engine | [expo-av](https://docs.expo.dev/versions/latest/sdk/av/) (`Audio.Sound`) |
| State management | [Zustand](https://zustand-demo.pmnd.rs) |
| Music API | [Audius](https://audius.co) public API (free, no auth) |
| Icons | [@expo/vector-icons](https://docs.expo.dev/guides/icons/) (Ionicons) |
| Gradients | [expo-linear-gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/) |

---

## Project structure

```
shuffle/
├── App.tsx                  # Root: navigation + MiniPlayer injection
├── src/
│   ├── api/
│   │   └── audius.ts        # getTrending(), searchTracks(), getTrack()
│   ├── components/
│   │   ├── MiniPlayer.tsx   # Persistent bottom player bar
│   │   └── TrackItem.tsx    # Song row used in Home and Search
│   ├── screens/
│   │   ├── HomeScreen.tsx   # Trending track list
│   │   ├── SearchScreen.tsx # Debounced search
│   │   ├── NowPlayingScreen.tsx  # Full player UI
│   │   └── LibraryScreen.tsx     # Liked songs + playlists
│   ├── state/
│   │   └── playerStore.ts   # Zustand store — all playback logic lives here
│   ├── theme/
│   │   └── index.ts         # Colors, Spacing, FontSize, BorderRadius tokens
│   └── types/
│       └── index.ts         # Track, Playlist, RepeatMode types
```

---

## Audio architecture

```
User taps track
      │
      ▼
playerStore.playTrack(track, queue)
      │  unloads previous Audio.Sound
      │  creates new Audio.Sound.createAsync({ uri: track.streamUrl })
      │
      ▼
Audius stream URL
  https://api.audius.co/v1/tracks/{id}/stream?app_name=Shuffle
      │  302/307 redirect → signed CDN MP3 on a content node
      │
      ▼
expo-av plays full MP3
      │  _onPlaybackUpdate fires every ~500 ms
      │  updates positionMs, durationMs, isPlaying in store
      │  auto-advances on didJustFinish (respects repeat/shuffle)
```

The entire player state (current track, queue, position, repeat, liked IDs) lives in a single Zustand store. Any component can read or drive playback by importing `usePlayerStore`.

---

## Running the app

### Prerequisites
- Node 18 +
- [Expo Go](https://expo.dev/go) on your phone **or** an Android/iOS emulator

### Install & start
```bash
npm install
npx expo start
```
Scan the QR code in the terminal with Expo Go. The app will load on your device over your local network.

### Run on a specific platform
```bash
npx expo start --android
npx expo start --ios        # macOS only
npx expo start --web        # browser preview (audio may differ)
```

---

## API reference (Audius)

All requests go to `https://api.audius.co/v1` with `?app_name=Shuffle` appended.

| Endpoint | Used for |
|---|---|
| `GET /tracks/trending?limit=N` | Home screen trending list |
| `GET /tracks/search?query=Q&limit=N` | Search results |
| `GET /tracks/{id}` | Single track metadata |
| `GET /tracks/{id}/stream` | 302 redirect → playable MP3 |

No authentication or API key is required.

---

## Contributing (for teammates)

1. Clone the repo and run `npm install`.
2. Each screen owns its own file in `src/screens/` — grab one.
3. All playback goes through `usePlayerStore` — don't manage audio outside the store.
4. Add new API calls to `src/api/audius.ts`.
5. Use the tokens in `src/theme/index.ts` for all colours and spacing.
6. Open a PR against `main` when your screen is ready.

---

## Team

Group assignment — 9 members. App name: **Shuffle**.
