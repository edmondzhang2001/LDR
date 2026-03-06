import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken, setApiLogout, getMe, updateProfile, getPartner, saveReunion as apiSaveReunion, endReunion as apiEndReunion, addUserPhoto, updateSettings, updateMood as apiUpdateMood } from '../lib/api';

const TOKEN_KEY = 'ldr_token';
const USER_KEY = 'ldr_user';

function normalizeUser(dataUser) {
  if (!dataUser) return null;
  return {
    id: dataUser.id,
    email: dataUser.email ?? undefined,
    name: dataUser.name ?? undefined,
    partnerId: dataUser.partnerId ?? null,
    reunion: dataUser.reunion ?? null,
    photos: Array.isArray(dataUser.photos) ? dataUser.photos : [],
    timezone: dataUser.timezone ?? undefined,
    mood:
      dataUser.mood?.emoji != null || dataUser.mood?.text != null
        ? { emoji: dataUser.mood.emoji ?? undefined, text: dataUser.mood.text ?? undefined }
        : undefined,
  };
}

function normalizeReunion(reunion) {
  if (!reunion || reunion.startDate == null) return null;
  return {
    startDate: reunion.startDate ?? null,
    endDate: reunion.endDate ?? null,
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
            // Auto-sync device timezone to backend so partner can show our local time
            try {
              const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
              if (tz) await updateSettings({ timezone: tz });
            } catch (_) {}
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
              reunion: normalizeReunion(data.partner.reunion),
              photos: Array.isArray(data.partner.photos) ? data.partner.photos : [],
              timezone: data.partner.timezone ?? undefined,
              mood:
                data.partner.mood?.emoji != null || data.partner.mood?.text != null
                  ? { emoji: data.partner.mood.emoji ?? undefined, text: data.partner.mood.text ?? undefined }
                  : undefined,
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

    /** Set reunion dates for both users; updates local user and partner state. */
    saveReunion: async (startDate, endDate) => {
      const data = await apiSaveReunion(startDate, endDate);
      const reunion = normalizeReunion(data.reunion);
      set((state) => ({
        user: state.user ? { ...state.user, reunion } : null,
        partner: state.partner ? { ...state.partner, reunion } : null,
      }));
      const { user } = get();
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return reunion;
    },

    /** Clear reunion for both users (end visit). */
    endReunion: async () => {
      await apiEndReunion();
      set((state) => ({
        user: state.user ? { ...state.user, reunion: null } : null,
        partner: state.partner ? { ...state.partner, reunion: null } : null,
      }));
      const { user } = get();
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    },

    /** Register a photo URL and optional caption after S3 upload; updates user.photos in store. */
    addPhotoAfterUpload: async (finalUrl, caption = '') => {
      const data = await addUserPhoto(finalUrl, caption);
      set((state) => ({
        user: state.user ? { ...state.user, photos: data.photos ?? [] } : null,
      }));
      return data.photos;
    },

    /** Update mood (emoji, text); syncs to backend and store. */
    updateMood: async (emoji, text) => {
      const data = await apiUpdateMood({ emoji: emoji ?? '', text: text ?? '' });
      const mood = data.mood ? { emoji: data.mood.emoji ?? undefined, text: data.mood.text ?? undefined } : undefined;
      set((state) => ({
        user: state.user ? { ...state.user, mood } : null,
      }));
      const { user } = get();
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return mood;
    },

    logout,
  };
});
