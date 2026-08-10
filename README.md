# Shuffle

A Spotify clone built with React Native + Expo, running on Windows and tested via Expo Go on iPhone.

This document explains what the app is, how it's built, what's finished, what's still open, and — most importantly — the one big architectural decision that's still pending: **how audio actually plays**.

---

## 1. What this app is

Shuffle is a mobile music-streaming app UI that looks and behaves like Spotify: browse, search, playlists, a mini-player, a full now-playing screen, queue, library, and a real "log in with Spotify" flow that pulls your actual profile and library data.

It is **not** a way to redistribute Spotify's catalog as your own audio — that's not legally possible for a third-party app (details in section 5). What it *can* legitimately be, and what it's built to be, is a custom Spotify client: real login, real personal data, real playlists — with the audio either standing in via a different open catalog (current state) or, once the pending decision below is resolved, controlled through your actual Spotify Premium account via Spotify's own remote-control APIs.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| App framework | React Native, via **Expo** (SDK 54) |
| Navigation | React Navigation — bottom tabs (Home/Search/Library) + a stack for modals and pushed screens |
| State management | Zustand (two stores: `authStore`, `playerStore`) |
| Local persistence | `@react-native-async-storage/async-storage` |
| Auth | Spotify OAuth 2.0 with PKCE, via `expo-auth-session` + `expo-web-browser` |
| Music metadata | Spotify Web API |
| Audio playback (current, temporary) | Audius API + `expo-audio` |
| Dev/test loop | Expo Go on a physical iPhone, over the same WiFi network |

### What "cross-platform" means for this codebase

Every file in [src/](src/) is shared — there is no separate iOS or Android codebase. React Native translates the same JSX (`<View>`, `<Text>`, etc.) into real native UI components on whichever platform it runs on (`UIView` on iOS, native `View` on Android) — it is not a webpage in a wrapper. The only place iOS and Android genuinely diverge is at **build/deployment time**: iOS produces an `.ipa` for the App Store, Android produces an `.apk`/`.aab` for Google Play, each with its own signing and store account. Today, none of that matters yet — Expo Go is a pre-built container app (already compiled for both platforms) that loads this project's JS live, so the same code is being tested on iPhone with zero build step.

### Do we need a Mac?

**Not for anything currently planned.** A Mac is only required if the project ever needs a *custom native module that Expo Go doesn't ship with*, forcing a local Xcode build. Even then, **EAS Build** (Expo's cloud build service) compiles iOS binaries in the cloud and `eas submit` uploads to the App Store — both runnable entirely from Windows. The audio option that used to assume "Phase 2 needs a Mac" (see section 5) is not the current plan.

---

## 3. Architecture

```
Screens (UI)  →  Zustand stores (authStore, playerStore)  →  API layer (spotify.ts, spotifyAuth.ts, audius.ts)  →  network
```

- **`src/screens/`** — one file per screen, all navigation-connected through `src/navigation/types.ts`.
- **`src/state/authStore.ts`** — holds Spotify tokens + logged-in user, persisted to `AsyncStorage`, exposes `getValidToken()` which auto-refreshes an expiring access token before any API call.
- **`src/state/playerStore.ts`** — owns playback state (current track, queue, position, shuffle/repeat) and the actual `expo-audio` player instance. This is the piece that changes shape once the audio decision below is resolved.
- **`src/api/spotify.ts`** — thin wrappers over Spotify Web API endpoints (profile, playlists, search, library).
- **`src/api/spotifyAuth.ts`** — OAuth constants (client ID, scopes, discovery URLs) and the refresh-token call.
- **`src/api/audius.ts`** — trending/search against Audius, used for actual audio right now.

---

## 4. What's built vs. what's not

**Working end-to-end:**

- Navigation shell — tabs + stack, modal Now Playing/Queue, pushed Artist/Album/Playlist/Profile screens ([App.tsx](App.tsx)).
- Spotify login — full PKCE authorize → exchange → refresh cycle, real account, real profile data ([ProfileScreen.tsx](src/screens/ProfileScreen.tsx)).
- Audio engine — play/pause/seek/skip/shuffle/repeat, position polling, auto-advance on track end, all via `expo-audio` against Audius streams ([playerStore.ts](src/state/playerStore.ts)).
- Home and Search — pull real trending/search results from Audius ([HomeScreen.tsx](src/screens/HomeScreen.tsx), [SearchScreen.tsx](src/screens/SearchScreen.tsx)).

**Half-finished / needs a decision, not just code:**

- Only the Profile screen talks to the real Spotify Web API. Home/Search still run entirely on Audius — the two data sources haven't been merged yet.
- Library and Playlist screens hold playlists in local `useState` only — nothing persists yet, and none of it reads from your real Spotify playlists.

**Not started:** Liked Songs, Queue, Artist, and Album screens are scaffolded but not wired to real data yet — worth checking screen-by-screen before building further on top.

---

## 5. Audio playback — the pending decision

This is the one architectural choice everything else is waiting on. It needs to be understood clearly, because the obvious-sounding option doesn't actually work.

### The constraint: Spotify's API cannot give you the audio file

Spotify's Web API returns **metadata only** — titles, artwork, playlists. It has never returned a downloadable/streamable audio file for a full track, and this isn't a missing feature, it's deliberate (that's their entire licensing business). `preview_url` (a 30-second clip) used to be available but Spotify locked it down for most apps in late 2024. There is no version of "call an endpoint, get the song back" available to a third-party app. So "fully replicate Spotify with their real audio" is off the table no matter how the rest of the app is built — every viable option below works by **controlling the real Spotify app**, not by playing the audio ourselves.

### Option A — remote-control the Spotify app via the Web API (recommended)

Spotify Premium accounts (you are one) can use the `/me/player` family of REST endpoints to remote-control **playback on an already-open device running the real Spotify app** — play, pause, skip, seek, see what's currently playing:

- `GET /me/player` — current state
- `PUT /me/player/play` / `pause`, with a `device_id` and either `context_uri` (album/playlist) or `uris` (specific tracks)
- `POST /me/player/next` / `previous`, `PUT /me/player/seek`
- `GET /me/player/devices` — find an active device to target

Shuffle would send commands; the actual Spotify app (already installed, already logged into your Premium account) does the decoding and audio output. This is plain HTTPS — **no native module, no native build, no Mac, works identically on iOS and Android, works from inside Expo Go today.** The one real UX constraint: there must be an "active device," meaning the real Spotify app has to have been opened at least once recently — Connect can hand it commands but can't launch it cold.

### Option B — `react-native-spotify-remote` (native SDK wrapper)

A React Native wrapper around Spotify's native iOS/Android "App Remote" SDK. Functionally it does almost the same thing as Option A — it also just remotely controls the real Spotify app, it does not decode audio inside your app either — but it talks to the Spotify app locally on-device via a native SDK instead of over the Web API. Because it's a native module, it requires a full native build (`expo run:ios` / EAS Build), which means leaving Expo Go for testing. No real audio-quality or capability advantage over Option A for this project — the tradeoff is purely "more native setup" for no functional gain.

### Option C — Web Playback SDK (in-app audio engine) — ruled out

This is the option that *sounds* like "real audio playing inside our own app," and it's the one to be clear is not available. It requires a browser's DRM stack (Widevine via EME). Every iOS app, including every browser app, is required by Apple to render through WebKit under the hood — there is no way to get a Chromium/Widevine rendering stack into a native iOS app (the only exception is a narrow EU-only carve-out for actual standalone browser apps, which doesn't apply here). This is a platform wall, not a library choice — no WebView package swap fixes it.

### Recommendation

**Option A.** Same real-audio-through-the-real-app result as Option B, none of the native-build cost, stays inside Expo Go, works on Windows the whole way through. This is what the rest of this README assumes once the decision is made — **but it has not been implemented yet.** Until then, Audius remains the playback source so the player isn't silent during development.

---

## 6. Spotify authentication — how it works

### Why PKCE, not a client secret

Spotify supports two OAuth flows. The traditional flow requires a **client secret**, which must never ship inside a mobile app binary (it's extractable). **PKCE** (Proof Key for Code Exchange) is designed for native/mobile apps — it replaces the secret with a one-time cryptographic challenge that's useless after the token exchange completes. No server required.

### The flow, step by step

1. **Code verifier generated** — a random 43–128 character string, created when the user taps "Log in with Spotify." `expo-auth-session` handles this automatically with `usePKCE: true`.
2. **Code challenge derived** — the verifier is SHA-256 hashed and base64url-encoded. Only the challenge leaves the device at this point.
3. **Browser opens Spotify's auth page** — `expo-web-browser` opens `https://accounts.spotify.com/authorize` with the client ID, scopes, redirect URI, and code challenge. User logs in and approves.
4. **Spotify redirects back with an authorization code** — a short-lived `code` query param lands on the registered redirect URI (`exp://<local-ip>:8081` in Expo Go, see below).
5. **Code exchanged for tokens** — `AuthSession.exchangeCodeAsync` sends the code + original verifier to `https://accounts.spotify.com/api/token`. Spotify checks the verifier hashes to the challenge from step 2, then issues an **access token** (1 hour) and a **refresh token** (long-lived).
6. **Tokens persisted** — stored in `AsyncStorage` under `shuffle_auth_v1`, so login survives app restarts.
7. **Auto-refresh** — `authStore.getValidToken()` checks expiry before every API call; if under 60 seconds remain, it silently refreshes and updates storage before returning the token.

### Scopes requested

| Scope | Why |
|---|---|
| `user-read-private` | Display name, country, profile image |
| `user-read-email` | Show email on Profile screen |
| `user-library-read` | Read liked songs |
| `user-library-modify` | Like / unlike tracks |
| `playlist-read-private` | User's own playlists in Library |
| `playlist-read-collaborative` | Collaborative playlists |
| `user-top-read` | Top tracks for Home recommendations |
| `user-read-recently-played` | Recently played chips on Home |
| `streaming` | Reserved — only relevant if Option B/C above were ever used; not needed for Option A |

**Once Option A is implemented**, add: `user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing` — required for the `/me/player` control endpoints.

### Redirect URI — what it is and how it was found

Spotify only redirects to URIs pre-approved in the Developer Dashboard, so a malicious app can't hijack the authorization code by impersonating this one.

`AuthSession.makeRedirectUri()` generates the correct URI for the current runtime automatically. It was captured by temporarily logging it from [ProfileScreen.tsx](src/screens/ProfileScreen.tsx):

```
LOG  [Auth] redirectUri: exp://192.168.18.8:8081
```

That exact value was registered in the Spotify dashboard.

| Environment | Redirect URI |
|---|---|
| Expo Go (current WiFi) | `exp://192.168.18.8:8081` |
| Future native build (only needed if Option B is chosen) | `shuffle://` |

**Important:** `192.168.18.8` is the dev machine's IP on its current network — it changes on a different WiFi network, and login will fail with `redirect_uri: Not matching configuration` until the new IP is logged and re-registered in the dashboard.

---

## 7. Known gaps / next steps

1. Decide and implement Option A (section 5) — add the three playback scopes, build `/me/player` wrappers in `spotify.ts`, switch `playerStore` to a remote-control mode with a fallback to Audius when there's no active Spotify device.
2. Wire Home/Search/Library to real Spotify data (`getFeaturedPlaylists`, `getNewReleases`, `getUserPlaylists`, `getUserLikedTracks`) instead of Audius, gated on `isAuthenticated`.
3. Persist locally-created playlists (Spotify has no concept of them unless created via the API too).
4. Remove `getRecommendations` in [spotify.ts](src/api/spotify.ts) — Spotify deprecated the `/recommendations` endpoint in November 2024; it 404s for all apps now.
5. Wire up Liked Songs, Queue, Artist, and Album screens to real data.
