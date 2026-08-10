# Shuffle

A Spotify clone built with React Native + Expo, running on Windows and tested via Expo Go on iPhone.

This document explains what the app is, how it's built, what's finished, what's still open, and — most importantly — the one big architectural decision behind how audio actually plays, and why it was made the way it was.

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

**Working end-to-end, logged in — real Spotify data and real playback via Connect (Option A, section 5):**

- Spotify login — full PKCE authorize → exchange → refresh cycle, real account, real profile data ([ProfileScreen.tsx](src/screens/ProfileScreen.tsx)).
- Home — your real top tracks and real playlists ([HomeScreen.tsx](src/screens/HomeScreen.tsx)).
- Search — real catalog search ([SearchScreen.tsx](src/screens/SearchScreen.tsx)).
- Library — your real playlists, plus creating a real playlist on your account ([LibraryScreen.tsx](src/screens/LibraryScreen.tsx)).
- Playlist — a real playlist's real tracks, playable ([PlaylistScreen.tsx](src/screens/PlaylistScreen.tsx)).
- Artist — real artist info, popular tracks (search-based stand-in, see section 7), and real albums ([ArtistScreen.tsx](src/screens/ArtistScreen.tsx)).
- Album — a real album's real tracks, playable ([AlbumScreen.tsx](src/screens/AlbumScreen.tsx)).
- Liked Songs — your own "Liked in Shuffle" list, persisted locally and mirrored to your real account where possible ([LikedSongsScreen.tsx](src/screens/LikedSongsScreen.tsx), section 9).
- Mini player, Now Playing, and Queue all reflect whichever engine is active (local or remote) without needing to know which ([MiniPlayer.tsx](src/components/MiniPlayer.tsx), [NowPlayingScreen.tsx](src/screens/NowPlayingScreen.tsx), [QueueScreen.tsx](src/screens/QueueScreen.tsx)).

**Logged out:** Home and Search fall back to Audius (free, full-length, no login needed) so the app is never empty or silent without an account. Library and playlist creation require login — matching real Spotify, which has no anonymous playlist creation either.

**Remaining gap:** deleting a real playlist isn't possible for any third-party app anymore (Spotify removed the only endpoint that did it) — Library offers "Remove from Shuffle" instead, which hides it locally without pretending to delete the real thing. See section 7.

---

## 5. Audio playback — the decision, and why

This is the one architectural choice everything else hangs off. It needs to be understood clearly, because the obvious-sounding option doesn't actually work — and it's worth understanding *why*, not just accepting it.

### Why Spotify developer credentials were needed in the first place

Before even getting to audio: registering an app in the Spotify Developer Dashboard (the client ID in [spotifyAuth.ts](src/api/spotifyAuth.ts)) is your app's **ID card with Spotify**. It's required for *any* interaction with Spotify's system, not just audio — it's what lets the login screen ask "Shuffle wants to access your account," lets the app read your real profile/playlists/liked songs, and (per the decision below) lets it send play/pause/skip commands. Without it, none of that — including the parts that already work today, like real login — would be possible. It isn't tied to which audio approach gets used; it's the baseline requirement for touching anything Spotify-owned at all.

### The constraint: Spotify's API cannot give you the audio file

Spotify's Web API returns **metadata only** — titles, artwork, playlists. It has never returned a downloadable/streamable audio file for a full track, and this isn't a missing feature, it's deliberate (that's their entire licensing business). `preview_url` (a 30-second clip) used to be available but Spotify locked it down for most apps in late 2024. There is no version of "call an endpoint, get the song back" available to a third-party app.

Spotify offers exactly three ways to touch a track, and it's worth walking through all three because they box you in the same way:

### Option A — remote-control the Spotify app via the Web API — chosen approach

Think of it like a walkie-talkie to a jukebox you're not allowed to open yourself: Shuffle doesn't touch the song at all, it just sends a message like "play this" / "pause" / "skip" to the real Spotify app already installed on the phone, and that app — which *is* allowed to touch the catalog — does the actual playing. Spotify Premium accounts (which this account is) can do this through the `/me/player` family of REST endpoints:

- `GET /me/player` — current state
- `PUT /me/player/play` / `pause`, with a `device_id` and either `context_uri` (album/playlist) or `uris` (specific tracks)
- `POST /me/player/next` / `previous`, `PUT /me/player/seek`
- `GET /me/player/devices` — find an active device to target

This is plain HTTPS — **no native module, no native build, no Mac, works identically on iOS and Android, works from inside Expo Go today.** The one real constraint: there must be an "active device," meaning the real Spotify app has to have been opened at least once recently — Connect can hand it commands but can't launch it cold.

The honest tradeoff, and the reason this needed spelling out explicitly: the sound is not coming out of Shuffle's own audio engine — it's coming out of the real Spotify app, with Shuffle acting as the remote. **There is no available option, for an indie/solo developer, where the real Spotify catalog plays independently inside Shuffle's own app process** — see Option C below for why not. You can have "app plays real Spotify songs" or "app is fully audio-independent," not both, for a project at this scale.

### Option B — `react-native-spotify-remote` (native SDK wrapper) — considered, not used

Same walkie-talkie idea as Option A, just a fancier radio: a React Native wrapper around Spotify's native iOS/Android "App Remote" SDK, which talks to the Spotify app locally on-device instead of over the web. Spotify's own documentation for this SDK states outright that you never get the raw audio data — same delegation to the real Spotify app as Option A, zero extra capability. The only difference is cost: it's a native module, so it requires a full native build (`expo run:ios` / EAS Build) and leaving Expo Go for testing, for no functional gain over Option A. Not used, for that reason.

### Option C — Web Playback SDK (in-app audio engine) — ruled out, and why

This is the option that *sounds* like "real audio playing inside our own app." It plays audio in a browser tab using DRM — encryption that only an authorized "player" holding the right digital key can unlock (this is what "DRM," Digital Rights Management, means: technology that locks digital content so only approved software/devices can play it). Spotify's Web Playback SDK is built specifically against **Widevine**, Google's DRM system.

Here's the wall: every browser on iOS — Safari, and also Chrome/Firefox/Edge for iOS — is required by Apple to run on Safari's underlying engine, WebKit. ("Chrome for iOS" is not actually Google's Chrome engine; it's WebKit wearing Chrome's interface, because Apple mandates this for all App Store browsers.) WebKit supports Apple's own DRM system, **FairPlay**, not Widevine — and Spotify never built a FairPlay-compatible version of their SDK. So the mismatch isn't "iOS blocks DRM," it's "Spotify's DRM system and iOS's DRM system are two different, incompatible locks," and that's true of every browser on iOS without exception.

The one real exception: since iOS 17.4 (2024), the **EU** (European Union, the political and economic union of European countries) forced Apple, under a law called the Digital Markets Act, to allow genuinely alternative browser engines — and a true Chromium-based Chrome now exists for iOS, but **only for devices/Apple IDs registered in the EU**, and only as the standalone Chrome app itself, not as something embeddable inside another app like Shuffle via a webview. It doesn't change anything for a general-audience app that can't require an EU region as a precondition to work at all.

So Option C is ruled out for a specific, verifiable reason — not a vague "iOS doesn't support it" — and no different browser or WebView library changes that.

### Decision: Option A — implemented

Chosen for the reasons above: real audio through the real, already-licensed Spotify app, no native build, no Mac, works from Windows and Expo Go today, and it's the only path that doesn't require giving up either "real Spotify catalog" or "buildable without leaving the current dev setup."

**Current implementation status:** wired into both the **Search** and **Home** screens — when logged in, they hit the real Spotify catalog (search results, your top tracks, your playlists) and tapping a track sends it to the real Spotify app via Connect. Logged out, both still fall back to Audius so nothing is ever silent or empty. **Library**, **Playlist**, **Artist**, **Album**, and **Liked Songs** are still not wired up — see section 7.

How it works in code:

- [`spotifyAuth.ts`](src/api/spotifyAuth.ts) now requests `user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing` instead of the unusable `streaming` scope.
- [`spotify.ts`](src/api/spotify.ts) adds `searchSpotifyTracks`, `getDevices`, `getPlaybackState`, `playOnDevice`, `pausePlayback`, `resumePlayback`, `seekPlayback`, `skipToNext`, `skipToPrevious` — thin wrappers over the `/me/player` endpoints described above.
- [`playerStore.ts`](src/state/playerStore.ts) now tracks a `mode: 'local' | 'remote'`. `playTrack` (existing Audius/`expo-audio` path) is untouched. A new `playSpotifyTrack` action finds an active device, sends the play command, then polls `GET /me/player` once a second to keep position/duration/play-state in sync with whatever the real Spotify app is actually doing — including if you change the track from the Spotify app itself. `togglePlay`/`seekTo`/`skipNext`/`skipPrev` all branch on `mode` so the existing UI (mini player, Now Playing screen, Queue) didn't need to change at all.
- If there's no active Spotify device, or the account isn't logged in, `remoteError` is set on the store and the calling screen shows it via an alert rather than failing silently.

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

1. ~~Implement Option A~~ — done, see section 5. Reachable from **Search** and **Home**.
2. ~~Wire Home to real Spotify data~~ — done. Logged in, Home now shows **Your Top Tracks** (`getUserTopTracks`, `/me/top/tracks`) and **Your Playlists** (`getUserPlaylists`, `/me/playlists`), both playable/navigable for real. Logged out, it still falls back to Audius so it's never empty.
3. ~~Wire Library to real Spotify data~~ — done, then corrected. Library lists real playlists (`getUserPlaylists`) and "New Playlist" calls the real `POST /me/playlists` (`createPlaylist`). Playlist creation now requires login — **real Spotify has no anonymous playlist creation either**, even on the free tier, so the earlier local-only fallback for logged-out users was actually a deviation from Spotify's own flow, not a faithful stand-in. It's been removed; tapping "+" while logged out now prompts you to log in, same as the real app would.
4. ~~Real delete-playlist~~ — checked and ruled out: `DELETE /playlists/{id}/followers`, the only endpoint that ever handled deleting/unfollowing a playlist, was also removed for Development Mode apps in Feb 2026. There is currently no way for any third-party app to delete a real playlist via the API. Long-press on a playlist now offers **"Remove from Shuffle"** instead — persisted locally (`shuffle_hidden_playlists_v1`), clearly labeled as hiding it from Shuffle's list only, since it still exists on the real account.
5. ~~Flesh out Artist and Album~~ — done. [ArtistScreen.tsx](src/screens/ArtistScreen.tsx) shows real artist info (`getArtist`), a "Popular" track list (`getArtistPopularTracks` — a search-based stand-in, since `/artists/{id}/top-tracks` is one of the endpoints removed Feb 2026), and real albums (`getArtistAlbums`); tapping an album opens [AlbumScreen.tsx](src/screens/AlbumScreen.tsx), which fetches the album's real tracks (`getAlbum`) and plays them through Connect. Reachable by tapping the artist name on Now Playing (only shown for real Spotify tracks, since Artist screen can't look up an Audius artist ID).
6. ~~Build out Playlist screen~~ — done. [PlaylistScreen.tsx](src/screens/PlaylistScreen.tsx) fetches real tracks via `getPlaylistTracks` (`GET /playlists/{id}/items` — originally shipped against the pre-rename `/tracks` path, caught and fixed, see section 8) and plays them through Connect, with a play-all button.
7. ~~Implement the Liked Songs plan~~ — done, see section 9.
8. ~~Recently Played~~ — done. Shuffle logs every track it plays to its own persisted history (`shuffle_recent_v1`), shown as Home's quick-access row. No API call involved — Shuffle already has this data by virtue of being the thing doing the playing.
9. ~~Device picker~~ — done. The device icon on Now Playing opens a real list of your available Spotify Connect devices and lets you switch playback to one (`transferPlayback`, `PUT /me/player`).
10. ~~"Shuffle Picks"~~ — done. Home shows it (logged in only, once you have top tracks to seed from) using `getArtistPopularTracks` against up to 3 of your own top-track artists, deduped against what's already in Your Top Tracks. Labeled in the UI itself as "our own guess... not Spotify's recommendations," not just here.
11. ~~Add/remove a single track from a playlist~~ — done. **Add**: the ellipsis button on Now Playing (previously dead) opens a playlist picker and calls `addTrackToPlaylist` (`POST /playlists/{id}/items`), confirmed via Spotify's own reference docs. **Remove**: long-press a track in the Playlist screen and confirm, calling `removeTrackFromPlaylist` (`DELETE /playlists/{id}/items`) — built from the last successfully-fetched official migration guide rather than a second independent confirmation, since Spotify's docs site went unreachable partway through verifying it. Test this one specifically before trusting it — see section 8.

Every screen listed in section 4 as a "coming soon" placeholder is now wired to real data, and every gap identified in this session — including both playlist-editing actions — has been addressed.

12. **Real bugs found from on-device testing**, all fixed:
    - `mapSpotifyPlaylist` read the playlist track-count from `raw.tracks.total` — but that field was also renamed to `items` in the same Feb 2026 change that affected `getPlaylistTracks` (see section 8). Every playlist showed "0 songs" even with real tracks inside. Fixed to read `raw.items.total`.
    - `spotifyFetch` crashed with a `SyntaxError` on play/pause/seek — Spotify sometimes returns a `200` with a non-JSON or blank body instead of the documented `204`, and the old code assumed any non-empty response was parseable JSON. Now falls back to `null` instead of throwing.
    - Now Playing's header showed a hardcoded "Shuffle" label where real Spotify shows nothing (just the back chevron and "···") — removed to match.
13. **Track action menu ("···")** — done, reachable from the "···" on any track row or Now Playing. Real Spotify's menu has ~13 items; only 6 have any public API path, so only those 6 are built: Add to Playlist, Add to Queue, Go to Queue, Go to Album, Go to Artist, Share, and Show Spotify Code (a public, unauthenticated Spotify endpoint that generates the scannable code image — no login needed for that specific piece). The other 7 (Hide in playlist, exclude from taste profile, Start a Jam, Go to radio, SongDNA, artists' concerts, song credits) have no public API at all — not built, not faked. See section 11 for the full breakdown.
14. **Swipe-to-queue** — done. Swiping a track row reveals an "Add to Queue" action, using the same `addToQueue` as the menu item. Required adding `react-native-gesture-handler` — bundled into Expo Go by default, so no native build was needed.
15. **Create tab** — done, added as a 4th tab matching real Spotify's layout. It doesn't navigate anywhere (neither does the real one) — it intercepts the tab press and opens the same "new playlist" flow Library uses, since that's the only action in Spotify's own Create sheet with a public API behind it (blends, AI DJ playlists, etc. have none).
16. **Mini player visual pass** — done. Added the thin top progress line real Spotify's mini player has, a device/Connect indicator when playing remotely, and a like ("+") button, and dropped the skip button to match the real app's default (collapsed) mini player layout more closely.
17. **Home filter pills actually do something** — done. "All"/"Music" show identical real content (the app is 100% music already, so that's honest, not a shortcut).
18. **Artist screen — partial redesign** — done, then a real bug caught and fixed. Full-width banner hero with a gradient (replacing the small circular avatar) and a "You liked N songs from this artist" row sourced from Liked in Shuffle are solid. The Follow/Following toggle was initially built against `PUT`/`DELETE /me/following` and `GET /me/following/contains` — a full API audit (section 7, item 20) found these are **dead**, folded into the same generic `/me/library` mechanism Liked Songs already uses. Fixed: `followArtist`/`unfollowArtist` now call `saveToLibrary`/`removeFromLibrary` with an `spotify:artist:` URI, and `isFollowingArtist` calls the new `isInLibrary` (`GET /me/library/contains`). The `user-follow-read`/`user-follow-modify` scopes added for the old approach were left in rather than removed — harmless to keep, and removing them risked a second guess on the same feature. **Not built**: the "Verified by Spotify" badge — not a real API field. **Also not built**: monthly-listener-style live stats, Video/Events/Merch tabs (no data source for any of them).
19. **Podcasts — added, then actually built for real.** The Podcasts pill was removed for a moment (previous entry in this list) on the assumption podcasts were an API wall like everything else here — that assumption was wrong. Checked properly: single-resource `GET /shows/{id}`, `GET /episodes/{id}`, `GET /me/shows`, and `GET /shows/{id}/episodes` all survived Feb 2026 — only the batch multi-id `GET /shows`/`GET /episodes` were removed, the exact same pattern as tracks/artists/albums. So the Podcasts pill is back in Library (where it lives in real Spotify too, not Home), showing your real saved shows (`getUserSavedShows`), and tapping one opens the new [ShowScreen.tsx](src/screens/ShowScreen.tsx) with real episodes (`getShowEpisodes`). Episodes are mapped onto the same `Track` shape songs use — a `spotify:episode:` URI plays through Connect exactly like `spotify:track:` does — so every existing playback/queue/menu path works for podcasts with no new player code at all.
20. **Full API coverage audit** — requested directly: go through everything Spotify's API still allows and confirm it's all built. Two real things surfaced:
    - **Fixed:** the Follow/Following toggle (item 18) was calling dead endpoints — caught and fixed, see item 18.
    - **Fixed:** Shuffle and Repeat in Now Playing only ever changed local state — while playing through Connect, tapping them never told the real device to actually shuffle or repeat, so they silently did nothing. Now calls `PUT /me/player/shuffle` and `PUT /me/player/repeat` (confirmed via Spotify's own reference docs) whenever `mode === 'remote'`.
    - Everything else confirmed already covered: playlists (list/create/tracks/add/remove), artists/albums (info/albums/tracks), podcasts (shows/episodes), library (like/unlike/follow via the generic mechanism), search, and the full player control surface (play/pause/seek/skip/queue/devices/shuffle/repeat).
    - Everything flagged as missing was then built — see item 21.
21. **Everything from the audit, built.**
    - **"Saved Albums in Shuffle"** — same pattern as Liked Songs: `GET /me/albums` (list) is dead, but `PUT`/`DELETE /me/library` (save/remove) and `GET /me/library/contains` (check one) both still work. Album screen got a real heart button (`setSavedAlbum`, `isInLibrary` for the accurate initial state — same reasoning as the Follow fix below), and Library's Albums tab now lists your Shuffle-saved albums for real.
    - **"Followed Artists in Shuffle"** — same idea: `GET /me/following` (list) is dead, so Library's Artists tab shows artists followed via Shuffle (`setFollowedArtistLocally`), while the Follow/Following button itself still shows the real, accurate state via `isFollowingArtist`.
    - **Real bug caught while building the above:** the first pass at both of these used a blind toggle based on local state alone — if you'd followed an artist or saved an album from the real Spotify app before ever opening Shuffle, tapping the button in Shuffle would do the *opposite* of what it displayed, because local and real state could disagree. Fixed by having both actions take the intended end state explicitly (`setFollowedArtistLocally(artist, isFollowing)`, `setSavedAlbum(album, isSaved)`) rather than toggling blindly.
    - **Playlist rename** — `PUT /playlists/{id}` (confirmed alive, not in any removed list). A pencil icon on the Playlist screen opens a rename modal.
    - **Volume control** — `PUT /me/player/volume` (confirmed via Spotify's reference docs). Added as a drag bar inside the device-picker modal on Now Playing.
    - **Podcasts got a sibling: Audiobooks.** `GET /audiobooks/{id}`, `GET /me/audiobooks`, and `GET /audiobooks/{id}/chapters` (single-resource, all confirmed alive — only batch `GET /chapters` was removed). New Audiobooks tab in Library, new [AudiobookScreen.tsx](src/screens/AudiobookScreen.tsx) — chapters mapped onto the `Track` shape exactly like podcast episodes, so they play through Connect with no new player code either.
    - **Intentionally still not built:** `GET /me/player/recently-played` — Shuffle already has its own version that's arguably more accurate (see section 11), so there's no reason to add Spotify's.

## 8. Spotify's shrinking API — what's actually accessible, and what it means

Every Spotify app starts in **Development Mode**: capped functionality, capped to 5 users, meant for building/testing. Full access ("Extended Quota Mode") requires applying to Spotify and getting manually approved — extended-quota apps are unaffected by anything below. Shuffle is a Development Mode app, and Spotify has cut Development Mode access twice since this project started, **without warning, both times** — first in November 2024, again in February 2026. This isn't a one-time gap to patch and forget; check this list (or Spotify's own changelog) before adding any new endpoint, because it keeps moving.

### What "removed" actually means

An endpoint being "removed for Development Mode" means the URL still exists, but calling it now returns an error (403/404) instead of data — the request goes out, Spotify's server refuses it. It's not a bug in this app's code; there is no code fix, only "don't call it" or "find a different endpoint that still works."

### What the `search` limit cut means

`limit` controls how many results come back in a single API call — a "page size," not a cap on how much data exists. Spotify used to allow up to 50 results per search request; since February 2026, Development Mode apps are capped at 10. To get more than 10 results, you'd make repeat calls using `offset` (e.g. `offset=10` for the next 10, `offset=20` after that) — this app currently only fetches one page, so search results are capped at the first 10 matches. [spotify.ts](src/api/spotify.ts) already clamps requests to this limit so calls don't just silently fail.

### Confirmed dead (do not build against these)

| Endpoint | Removed | What it did |
|---|---|---|
| `/recommendations` | Nov 2024 | Algorithmic "songs like this" suggestions |
| `/audio-features`, `/audio-analysis` | Nov 2024 | Tempo/key/energy data per track |
| `/related-artists` | Nov 2024 | "Fans also like" artist suggestions |
| `/browse/featured-playlists` | Feb 2026 | Spotify's editorial front-page playlists |
| `/browse/new-releases` | Feb 2026 | Editorial new-release list |
| `/browse/categories` | Feb 2026 | Genre/mood browse categories |
| `GET /artists/{id}/top-tracks` | Feb 2026 | An artist's top tracks by country — see Artist screen below for the search-based stand-in used instead |
| Other users' profiles/playlists, batch/multi-id fetches | Feb 2026 | Catalog browsing beyond your own account, or fetching several artists/albums/tracks in one call |
| `GET /me/tracks` | Feb 2026 | **Listing** your liked/saved songs — see section 9, this is why Liked Songs needs a workaround |
| `DELETE /playlists/{id}/followers` | Feb 2026 | The only endpoint that ever handled deleting/unfollowing a playlist — see Library above for the "Remove from Shuffle" workaround |
| `GET`/`POST`/`DELETE /playlists/{id}/tracks` | Feb 2026 | **Renamed**, not removed — replaced by `/playlists/{id}/items` (the field inside each item also renamed `.track` → `.item`). This was live in [spotify.ts](src/api/spotify.ts) under the old dead path until it was caught and fixed — see the note below. |

**A real bug this caught:** `getPlaylistTracks` was still calling the pre-rename `/tracks` path when the Playlist/Artist/Album work in section 7 was built — it would have returned nothing the first time you actually opened a real playlist. Fixed to call `/items` and read `.item` instead of `.track`. Also: creating/modifying a playlist requires the `playlist-modify-public`/`playlist-modify-private` scopes, which had never been requested — added to [spotifyAuth.ts](src/api/spotifyAuth.ts). **Because scopes changed, you'll need to log out and log back in once** for the new permissions to take effect — the old token doesn't retroactively gain them.

Adding/removing a single track from a playlist (`POST`/`DELETE /playlists/{id}/items`) is now implemented — see section 7, item 11. `POST` (`addTrackToPlaylist`) is confirmed via Spotify's own reference docs: body `{uris: [uri], position?}`. `DELETE` (`removeTrackFromPlaylist`) is built on the single official source reached before Spotify's docs site went unreachable mid-session: the Feb 2026 migration guide's own words, *"parameter `tracks` renamed to `items`"* — so path `/playlists/{id}/items`, body `{items: [{uri}]}`, same shape the endpoint always used, just the outer key renamed. Unlike everything else in this README, this one specific shape was not cross-checked against a second independent source — flagged in the code comment too. Test it before relying on it.

### Confirmed still working (safe to build on)

`GET /me` (your profile), `GET /me/playlists` (your own playlists), `POST /me/playlists` (create a playlist), `GET /me/top/tracks` (your top tracks), `GET /playlists/{id}/items` (a playlist's tracks — renamed from `/tracks`, see above), `POST /playlists/{id}/items` (add a track — confirmed), single-resource `GET /artists/{id}` and `GET /artists/{id}/albums`, single-resource `GET /albums/{id}`, single-resource `GET /shows/{id}`, `GET /episodes/{id}`, `GET /me/shows`, and `GET /shows/{id}/episodes` (podcasts — only the batch multi-id versions were removed, same pattern as tracks/artists/albums), `GET/PUT/DELETE /me/following` (follow/unfollow an artist — not independently re-verified, same caveat as below), the full `/me/player` family (all of Option A — search, play, pause, seek, skip, devices, plus `/me/player/queue`), `GET /search` (capped at `limit=10`), and `PUT`/`DELETE /me/library` (like/unlike a track or album — write-only, see section 9). `DELETE /playlists/{id}/items` (remove a track) is *believed* working — single-source, not cross-checked, see above.

---

## 9. Liked Songs — implemented, given `GET /me/tracks` is gone

Spotify still lets an app **write** a like (`PUT /me/library`) and **check** a single track (`GET /me/library/contains`), but there is no documented way to **list** everything you've ever liked. That rules out a Liked Songs screen that mirrors your real, complete Spotify like history — that data simply isn't reachable anymore for a Development Mode app.

**What's built:** Shuffle keeps its own persisted list of "songs liked in Shuffle" — [playerStore.ts](src/state/playerStore.ts) now stores `likedTracks` (a full track map, not just ids) in `AsyncStorage` under `shuffle_liked_v1`, loaded on app start the same way `authStore` restores tokens. Tapping the heart on Now Playing calls `toggleLike(track)`, which:

1. Updates the local list immediately and persists it.
2. If the track is a real Spotify track, also calls `PUT /me/library` (like) or `DELETE /me/library` (unlike) — a genuine like on the real account, one-directional: Shuffle can tell Spotify "I liked this," but can never ask Spotify "what have I liked," including anything liked from the real app before Shuffle existed.

[LikedSongsScreen.tsx](src/screens/LikedSongsScreen.tsx) shows this list, labeled **"Liked in Shuffle"** with an explanation in the UI itself — not just this README — so it's never mistaken for a full Spotify history. [LibraryScreen.tsx](src/screens/LibraryScreen.tsx)'s song count now reads from the same persisted store.

---

## 10. Running the TypeScript checker

From a terminal opened in the project root (`c:\Users\user\Documents\Dev-ing\spotify-clone` — in VS Code, **Terminal → New Terminal** opens one there automatically), run:

```sh
npx tsc --noEmit
```

This type-checks the whole project without producing build output — it's the fastest way to catch a broken import or mismatched type before bothering to reload the app on your phone. Run it after any non-trivial change, especially ones touching `spotify.ts`, `playerStore.ts`, or the screens.

---

## 11. Spotify vs. Shuffle — the full comparison

This is the honest side-by-side: everything the real Spotify app does, what Spotify's API actually lets any outside app like Shuffle ask for, and what Shuffle does about it. Where Spotify's API says no, the explanation of what Shuffle built instead lives right there in the third column — same idea as "Liked in Shuffle."

All four of Shuffle's own workarounds discussed in this session — Liked in Shuffle, Recently Played, the device picker, and Shuffle Picks — are built and reflected below. **Worth being precise about the difference**, since it's easy to blur: those four exist because Spotify's API genuinely cannot provide that data anymore, so Shuffle keeps its own copy or makes its own guess instead. Adding/removing a track from a playlist is not in that category — both are real calls to Spotify's real API that really modify the real playlist on your real account. The table below marks each row as one or the other.

| What Spotify Does | What the API Gives Access To | What Shuffle Does |
|---|---|---|
| Log in to your account | Full access — official login | Real login with your real Spotify account, same as the real app. |
| Home screen — personalized picks | Your top tracks, your playlists | Shows both, for real. |
| Home screen — "New Releases" / "Recommended for You" | Removed entirely, no substitute | "Shuffle Picks" — Shuffle's own guess, built by searching a few of your own top artists, clearly labeled in the app as a guess, not Spotify's real picks. |
| Home screen — "Recently Played" | No reliable way to ask Spotify for this | Shuffle already sees every song you play, so it writes its own list down as you go — no need to ask Spotify at all. Shown as the quick-access row on Home. |
| Search for songs, artists, albums | Full access | Real search, same as the real app (limited to fewer results per search than Spotify's own app, since the API only hands back 10 at a time now instead of 50). |
| Play a full song | Not directly — no app outside Spotify itself can play the actual audio file | Shuffle tells the real Spotify app (already on your phone) what to play, and that app plays it. Sounds identical, just controlled remotely instead of played inside Shuffle. |
| Pause / skip / seek / shuffle / repeat | Full access | All real, all working. |
| Choose which device plays (phone, speaker, etc.) | Full access — the list of your devices is available | The device list was already being fetched and used silently; now there's an actual picker (tap the device icon on Now Playing) so you can choose instead of Shuffle picking for you. |
| View your playlists | Full access | Real, your actual playlists. |
| Create a playlist | Full access, but requires login (same as real Spotify — no anonymous playlist creation there either) | Real — creates an actual playlist on your account. |
| Delete a playlist | Removed entirely, no substitute | "Remove from Shuffle" — hides it from Shuffle's own list only. It's still on your real account; Spotify just won't let any outside app delete it anymore. |
| Add / remove songs in a playlist | Both moved to a renamed endpoint (`/items` instead of `/tracks`) | Add: the "···" button on Now Playing opens a playlist picker (confirmed shape). Remove: long-press a track in a playlist to remove it (built from one official source rather than two — worth testing carefully, see section 8). |
| Like a song | Can like a song, but can't read back your full liked list | "Liked in Shuffle" — its own saved list, kept in sync one-way: liking here also really likes it on Spotify, but Shuffle can't rebuild the list from your Spotify history. |
| View an artist's page | Basic info and albums, yes; "top tracks" specifically was removed | Real artist info and real albums; "Popular" tracks are found by searching the artist's name instead, since the real top-tracks list isn't available anymore. |
| View an album's page | Full access | Real, all real tracks. |
| Queue — view / play next | Full access to control what plays next | Real, working. |
| Queue — drag to reorder | Full access to set what plays next | Not built yet — currently no drag-to-reorder in the Queue screen. |
| Download songs for offline listening | Never available to outside apps for real Spotify tracks — that audio never reaches Shuffle at all | Not possible for real Spotify tracks. Could be added for the Audius fallback tracks specifically, since those are real downloadable files. |
| Lyrics | Never available to outside apps, unrelated to any recent Spotify change | Not built. Would need a separate, different lyrics service entirely — not a Spotify limitation to work around, a missing feature to add. |
| Crossfade, gapless playback, sound quality settings | Not available to outside apps | Not possible under the current setup — these are things only the app actually playing the audio can control, and that's the real Spotify app, not Shuffle. |
| See friends' activity / collaborative playlists | Other people's private data, never available to outside apps | Not possible — no workaround exists, since it isn't Shuffle's data to keep a copy of. |
| Podcasts | Full access — real shows, episodes, and your saved shows | Library's Podcasts pill shows your real saved shows; tapping one opens real episodes, playable through Connect just like songs. |
