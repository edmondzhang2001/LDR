import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken, setApiLogout } from '../lib/api';

const TOKEN_KEY = 'ldr_token';
const USER_KEY = 'ldr_user';

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

    setPartnerId: (partnerId) => set({ partnerId }),

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
      const user = {
        id: data.user.id,
        email: data.user.email,
        partnerId: data.user.partnerId ?? null,
      };
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setApiToken(data.token);
      set({ token: data.token, user, partnerId: user.partnerId });
    },

    logout,
  };
});
