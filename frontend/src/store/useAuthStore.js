import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken, setApiLogout, getMe, updateProfile, getPartner } from '../lib/api';

const TOKEN_KEY = 'ldr_token';
const USER_KEY = 'ldr_user';

function normalizeUser(dataUser) {
  if (!dataUser) return null;
  return {
    id: dataUser.id,
    email: dataUser.email ?? undefined,
    name: dataUser.name ?? undefined,
    partnerId: dataUser.partnerId ?? null,
  };
}

export const useAuthStore = create((set, get) => {
  /** Clears all auth state and stored tokens; use when session is invalid or user logs out. */
  const logout = () => {
    setApiToken(null);
    SecureStore.deleteItemAsync(TOKEN_KEY);
    SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null, partnerId: null, partner: null, hydrated: true, sessionVerified: true });
  };

  setApiLogout(logout);

  return {
    token: null,
    user: null,
    partnerId: null,
    partner: null,
    hydrated: false,
    /** True until initAuth() has finished (success or fail). Blocks routing until backend verification is done. */
    isAuthLoading: true,
    /** True after initAuth has run (session verified with backend or confirmed no token). */
    sessionVerified: false,

    setPartnerId: (partnerId) => set((state) => {
      const user = state.user ? { ...state.user, partnerId } : null;
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return { partnerId, user };
    }),

    /** Update user in store (e.g. after profile update). Persists to SecureStore. */
    setUser: (user) => set((state) => {
      if (!user) return state;
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return {
        user,
        partnerId: user.partnerId ?? state.partnerId,
      };
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

    /**
     * Run once on app mount: hydrate from storage, then verify session with GET /api/auth/me.
     * On 401/404 (invalid or missing user), calls logout() to clear stale local state.
     * Sets sessionVerified when done so the routing guard can run. Always sets isAuthLoading: false in finally.
     */
    initAuth: async () => {
      try {
        if (!get().hydrated) await get().hydrate();
        const { token } = get();
        if (!token) {
          set({ sessionVerified: true });
          return;
        }
        try {
          const data = await getMe();
          const user = normalizeUser(data.user);
          if (user) {
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
            set({ user, partnerId: user.partnerId ?? null, sessionVerified: true });
          } else {
            set({ sessionVerified: true });
          }
        } catch (e) {
          const status = e.response?.status;
          if (status === 401 || status === 404) logout();
          else set({ sessionVerified: true });
        }
      } finally {
        set({ isAuthLoading: false });
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

    signInWithOAuth: async (provider, identityToken, nameFromOAuth) => {
      const body = { provider, identityToken };
      if (typeof nameFromOAuth === 'string' && nameFromOAuth.trim()) {
        body.name = nameFromOAuth.trim();
      }
      const { data } = await api.post('/auth/oauth', body);
      const user = normalizeUser(data.user);
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setApiToken(data.token);
      set({ token: data.token, user, partnerId: user.partnerId });
    },

    /** Fetch partner profile (GET /api/user/partner) and save to store. */
    fetchPartner: async () => {
      const { partnerId } = get();
      if (!partnerId) return null;
      try {
        const data = await getPartner();
        const partner = data.partner
          ? {
              id: data.partner.id,
              name: data.partner.name ?? undefined,
              email: data.partner.email ?? undefined,
              location: data.partner.location,
              batteryLevel: data.partner.batteryLevel ?? null,
              lastUpdatedDataAt: data.partner.lastUpdatedDataAt ?? null,
            }
          : null;
        set({ partner });
        return partner;
      } catch {
        return null;
      }
    },

    /** Update profile (name) and sync store. */
    updateProfileName: async (name) => {
      const data = await updateProfile({ name });
      const user = normalizeUser(data.user);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set((state) => ({ user, partnerId: user.partnerId ?? state.partnerId }));
      return user;
    },

    logout,
  };
});
