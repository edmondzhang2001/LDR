import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken, setApiLogout, getMe } from '../lib/api';

const TOKEN_KEY = 'ldr_token';
const USER_KEY = 'ldr_user';

function normalizeUser(dataUser) {
  if (!dataUser) return null;
  return {
    id: dataUser.id,
    email: dataUser.email ?? undefined,
    partnerId: dataUser.partnerId ?? null,
  };
}

export const useAuthStore = create((set, get) => {
  const logout = () => {
    setApiToken(null);
    SecureStore.deleteItemAsync(TOKEN_KEY);
    SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null, partnerId: null, hydrated: true });
  };

  setApiLogout(logout);

  return {
    token: null,
    user: null,
    partnerId: null,
    hydrated: false,

    setPartnerId: (partnerId) => set((state) => {
      const user = state.user ? { ...state.user, partnerId } : null;
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return { partnerId, user };
    }),

    /** Fetch /api/auth/me and update user + partnerId (and persist). Call on app load and when polling after generating code. */
    refreshUser: async () => {
      const { token } = get();
      if (!token) return null;
      try {
        const data = await getMe();
        const user = normalizeUser(data.user);
        if (!user) return null;
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        set({ user, partnerId: user.partnerId ?? null });
        return user;
      } catch {
        return null;
      }
    },

    hydrate: async () => {
      try {
        const [token, userJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        const user = userJson ? JSON.parse(userJson) : null;
        const partnerId = user?.partnerId ?? null;
        if (token) setApiToken(token);
        set({ token, user, partnerId, hydrated: true });
      } catch {
        set({ hydrated: true });
      }
    },

    signInWithOAuth: async (provider, identityToken) => {
      const { data } = await api.post('/auth/oauth', {
        provider,
        identityToken,
      });
      const user = normalizeUser(data.user);
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setApiToken(data.token);
      set({ token: data.token, user, partnerId: user.partnerId });
    },

    logout,
  };
});
