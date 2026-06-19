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

---

## Spotify authentication — how it works

### Why PKCE, not a client secret

Spotify supports two OAuth flows. The traditional flow requires a **client secret** — a credential that must never be shipped in a mobile app (it would be extractable from the binary). The alternative is **PKCE** (Proof Key for Code Exchange), designed specifically for native and mobile apps. It replaces the secret with a one-time cryptographic challenge that is useless after the token exchange completes. The Spotify Developer Dashboard supports PKCE natively; no server is needed.

### The flow, step by step

1. **App generates a code verifier** — a random 43–128 character string, created at the moment the user taps "Log in with Spotify". `expo-auth-session` handles this automatically when `usePKCE: true` is set.

2. **Code challenge is derived** — the verifier is hashed with SHA-256 and base64url-encoded to produce the code challenge. Only the challenge leaves the device at this step.

3. **Browser opens Spotify's auth page** — `expo-web-browser` opens `https://accounts.spotify.com/authorize` with the client ID, requested scopes, redirect URI, and the code challenge. The user logs in and approves the app.

4. **Spotify redirects back with an authorization code** — Spotify sends the user back to the redirect URI with a short-lived `code` query parameter. In Expo Go this redirect lands on `exp://[local-ip]:8081` (we confirmed the exact format by logging `AuthSession.makeRedirectUri()` to the Metro terminal — see the Redirect URI section below); in the Phase 2 native build it lands on `shuffle://`.

5. **Code is exchanged for tokens** — `AuthSession.exchangeCodeAsync` sends the authorization code plus the original code verifier to `https://accounts.spotify.com/api/token`. Spotify verifies that the verifier hashes to the challenge it received in step 3, then issues an **access token** (valid 1 hour) and a **refresh token** (long-lived).

6. **Tokens are persisted** — both tokens are stored in `AsyncStorage` under the key `shuffle_auth_v1` so the user stays logged in across app restarts.

7. **Auto-refresh** — `authStore.getValidToken()` checks the expiry before every Spotify API call. If the access token has less than 60 seconds remaining, it silently calls the token endpoint with the refresh token and updates storage before returning the new token.

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
| `streaming` | Required for Phase 2 Spotify SDK audio |

### Redirect URI — what it is, how we found it, and why it's needed

When Spotify finishes authenticating the user, it redirects the browser back to the app using a URI you register in the Spotify Developer Dashboard. This is a security requirement — Spotify will only redirect to URIs you have pre-approved, so a malicious app cannot hijack your authorization code by pretending to be your app.

**How we found the exact URI to register**

`AuthSession.makeRedirectUri()` generates the correct URI for the current runtime environment automatically. To see what it actually produces, a temporary log was added to [ProfileScreen.tsx](src/screens/ProfileScreen.tsx):

```ts
const redirectUri = AuthSession.makeRedirectUri();
console.log('[Auth] redirectUri:', redirectUri);
```

Opening the Profile screen printed this to the Metro terminal:

```
LOG  [Auth] redirectUri: exp://192.168.18.8:8081
```

That exact string — `exp://192.168.18.8:8081` — was then added to the Spotify Developer Dashboard under **Redirect URIs**. The log line was removed once auth was confirmed working.

**URIs registered in the Spotify dashboard**

| Environment | Redirect URI |
|---|---|
| Expo Go (development, current WiFi) | `exp://192.168.18.8:8081` |
| Phase 2 native build | `shuffle://` |

**Important:** `192.168.18.8` is the local IP of the development machine on the current network. If you move to a different WiFi network, `makeRedirectUri()` will produce a different IP and login will fail with `redirect_uri: Not matching configuration`. Re-run the log trick above to get the new URI, add it to the dashboard, and login will work again.
