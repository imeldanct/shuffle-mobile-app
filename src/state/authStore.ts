import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { refreshSpotifyToken } from '../api/spotifyAuth';

const STORAGE_KEY = 'shuffle_auth_v1';

export interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
  imageUrl: string | null;
}

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  user: SpotifyUser | null;
  isAuthenticated: boolean;

  setTokens: (access: string, refresh: string, expiresIn: number) => Promise<void>;
  setUser: (user: SpotifyUser) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
  user: null,
  isAuthenticated: false,

  setTokens: async (access, refresh, expiresIn) => {
    const tokenExpiry = Date.now() + expiresIn * 1000;
    set({ accessToken: access, refreshToken: refresh, tokenExpiry, isAuthenticated: true });
    const stored: StoredAuth = { accessToken: access, refreshToken: refresh, tokenExpiry };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    set({ accessToken: null, refreshToken: null, tokenExpiry: null, user: null, isAuthenticated: false });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { accessToken, refreshToken, tokenExpiry }: StoredAuth = JSON.parse(raw);
      if (refreshToken) {
        set({ accessToken, refreshToken, tokenExpiry, isAuthenticated: true });
      }
    } catch {
      // corrupted storage — start fresh
    }
  },

  getValidToken: async () => {
    const { accessToken, refreshToken, tokenExpiry, setTokens } = get();
    if (!refreshToken) return null;

    // Token still valid (60 s buffer)
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60_000) {
      return accessToken;
    }

    // Refresh
    try {
      const data = await refreshSpotifyToken(refreshToken);
      const newRefresh = data.refresh_token ?? refreshToken;
      await setTokens(data.access_token, newRefresh, data.expires_in);
      return data.access_token;
    } catch {
      return null;
    }
  },
}));
