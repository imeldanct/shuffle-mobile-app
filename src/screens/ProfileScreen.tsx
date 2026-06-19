import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMe } from '../api/spotify';
import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY, SPOTIFY_SCOPES } from '../api/spotifyAuth';
import { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../state/authStore';
import { BorderRadius, Colors, FontSize, Spacing } from '../theme';

// Required: closes the auth browser and hands the result back to the app
WebBrowser.maybeCompleteAuthSession();

type Nav = NativeStackNavigationProp<RootStackParamList>;

const redirectUri = AuthSession.makeRedirectUri();

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, setTokens, setUser, logout } = useAuthStore();
  const exchangedRef = useRef(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      usePKCE: true,
      redirectUri,
    },
    SPOTIFY_DISCOVERY,
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    if (exchangedRef.current) return;
    exchangedRef.current = true;
    const code = response.params.code;
    if (!code || !request?.codeVerifier) return;

    AuthSession.exchangeCodeAsync(
      {
        clientId: SPOTIFY_CLIENT_ID,
        code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      SPOTIFY_DISCOVERY,
    )
      .then(async (tokenRes) => {
        await setTokens(
          tokenRes.accessToken,
          tokenRes.refreshToken ?? '',
          tokenRes.expiresIn ?? 3600,
        );
        const me = await getMe(tokenRes.accessToken);
        setUser({
          id: me.id,
          displayName: me.display_name ?? me.id,
          email: me.email ?? '',
          imageUrl: me.images?.[0]?.url ?? null,
        });
      })
      .catch(console.error);
  }, [response]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back button */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={28} color={Colors.text} />
      </TouchableOpacity>

      {isAuthenticated && user ? (
        /* ── Logged-in state ── */
        <View style={styles.center}>
          {user.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{user.displayName[0].toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={logout}>
            <Text style={styles.outlineBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Logged-out state ── */
        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <Ionicons name="musical-notes" size={52} color={Colors.primary} />
          </View>
          <Text style={styles.name}>Shuffle</Text>
          <Text style={styles.sub}>
            Log in to see your profile, playlists, and liked songs.
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, !request && styles.loginBtnDisabled]}
            onPress={() => promptAsync()}
            disabled={!request}
          >
            {!request ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.loginBtnText}>Log in with Spotify</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  back: { padding: Spacing.md },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: Spacing.sm },
  avatarFallback: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: Colors.background, fontSize: FontSize.xxl, fontWeight: '700' },

  logoWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },

  name: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', textAlign: 'center' },
  email: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },

  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    minWidth: 220,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },

  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    minWidth: 220,
    alignItems: 'center',
  },
  outlineBtnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
});
