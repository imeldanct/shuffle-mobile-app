# Shuffle

A Spotify clone built with React Native + Expo. Here is exactly how it is being achieved.

---

## How we are building this

### The goal

A fully functioning Spotify clone that plays full-length Spotify tracks, uses real Spotify data, and lets users log in with their Spotify account.

### The two-phase approach

We cannot build everything in one go because playing full Spotify tracks on iOS requires compiling native code, which requires a Mac. Development is being done on Windows. So the build is split into two phases.

---

**Phase 1 — Windows, Expo Go (current)**

Everything except Spotify audio is built and tested here:

- All screens: Home, Search, Now Playing, Library, Profile, Queue
- Login with Spotify via OAuth — real authentication, real user data, real playlists
- Spotify Web API — real catalog, real search, real recommendations
- Audio playback via Audius — a free, open music platform used as a stand-in so the player is not silent during development. Audius streams full-length tracks with no API key required.

All code written in this phase carries over to Phase 2 unchanged.

---

**Phase 2 — Mac, native build**

One targeted swap once the UI is complete:

- Replace Audius audio with `react-native-spotify-remote`, a React Native wrapper around the official Spotify iOS SDK
- This package controls the Spotify app on the device, using it as the audio engine — so full Spotify tracks play through your Premium account
- Build the native iOS app using `npx expo run:ios` on the Mac
- The rest of the app (screens, auth, data, state) is untouched

---

### Why Expo Go for now and not a native build from the start

Expo Go allows instant hot-reload on a physical iPhone over WiFi — a code change appears on the phone in seconds. A native build takes 15–20 minutes per compile. Since most of the work is UI and data (not native audio), Expo Go is the right tool for Phase 1. We switch to native only when the UI is done and we need Spotify audio.

---

### What the final app uses

| Concern | Solution |
|---|---|
| Authentication | Spotify OAuth (login with your Spotify account) |
| Music data | Spotify Web API (search, browse, playlists, recommendations) |
| Audio playback | `react-native-spotify-remote` → Spotify app → full songs via Premium |
| Audio during development | Audius API (full-length tracks, free, no key) |
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| State management | Zustand |
| Navigation | React Navigation (bottom tabs) |
