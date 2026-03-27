import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as AppleAuthentication from 'expo-apple-authentication';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api, setApiToken, setApiLogout, getMe, updateProfile, getPartner, saveReunion as apiSaveReunion, endReunion as apiEndReunion, addUserPhoto, updateSettings, updateMood as apiUpdateMood, updatePushToken, unlinkPartner as apiUnlinkPartner, getTodaysPhotos, deletePhoto as apiDeletePhoto, stitchOnboardingSession } from '../lib/api';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
let getAppGroupDirectory = () => null;
let reloadWidget = () => {};
try {
  const shared = require('../../modules/shared-storage');
  getAppGroupDirectory = shared.getAppGroupDirectory;
  reloadWidget = shared.reloadWidget;
} catch {
  // shared-storage is iOS-only; no-op on web/Android
}

let PartnerPictureWidget;
try {
  PartnerPictureWidget = require('../../targets/widget/PartnerPictureWidget').default;
} catch {
  PartnerPictureWidget = null;
}

const TOKEN_KEY = 'ldr_token';
const USER_KEY = 'ldr_user';
const ONBOARDING_SESSION_KEY = 'ldr_onboarding_session_id';

function parseFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { firstName: undefined, lastName: undefined };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildFullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(' ') || undefined;
}

async function stitchOnboardingIfPresent() {
  try {
    const sessionId = await SecureStore.getItemAsync(ONBOARDING_SESSION_KEY);
    if (!sessionId) return;
    await stitchOnboardingSession(sessionId);
  } catch {
    // Ignore stitch errors to avoid blocking auth flow.
  }
}

function normalizeUser(dataUser) {
  if (!dataUser) return null;
  const parsed = parseFullName(dataUser.name);
  const firstName = dataUser.firstName ?? parsed.firstName;
  const lastName = dataUser.lastName ?? parsed.lastName;
  return {
    id: dataUser.id,
    email: dataUser.email ?? undefined,
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    name: buildFullName(firstName, lastName) ?? dataUser.name ?? undefined,
    partnerId: dataUser.partnerId ?? null,
    createdAt: typeof dataUser.createdAt === 'string' ? dataUser.createdAt : undefined,
    hasPremiumAccess: Boolean(dataUser.hasPremiumAccess),
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

function extractDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getUtcCalendarDayDiff(targetDate, nowValue = Date.now()) {
  const targetDateOnly = extractDateOnly(targetDate);
  if (!targetDateOnly) return null;

  const target = new Date(`${targetDateOnly}T00:00:00.000Z`);
  const now = new Date(nowValue);
  const nowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const today = new Date(`${nowKey}T00:00:00.000Z`);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / dayMs);
}

/** Write stats.json and calendar.json to App Group and reload widgets. Uses reunion.startDate for calendar; partner for stats.
 * statsExtras: optional { location, partnerTime, weatherTemp, weatherIcon } for Duva Stats widget. */
async function writeWidgetData(partner, reunion, statsExtras) {
  try {
    const sharedPath = getAppGroupDirectory('group.com.edmond.duva');
    if (!sharedPath) return;
    const baseUri = 'file://' + sharedPath;
    const lastActive =
      partner?.lastActive ??
      (partner?.lastUpdatedDataAt ? new Date(partner.lastUpdatedDataAt).toISOString() : null);
    const statsPayload = {
      name: partner?.name ?? null,
      streak: partner?.streak ?? 0,
      lastActive,
      batteryLevel: partner?.batteryLevel ?? null,
      ...(statsExtras && {
        location: statsExtras.location ?? null,
        partnerTime: statsExtras.partnerTime ?? null,
        weatherTemp: statsExtras.weatherTemp ?? null,
        weatherIcon: statsExtras.weatherIcon ?? null,
      }),
    };
    await FileSystem.writeAsStringAsync(
      `${baseUri}/stats.json`,
      JSON.stringify(statsPayload)
    );
    const reunionDate = extractDateOnly(reunion?.startDate);
    const daysDiff = reunionDate ? getUtcCalendarDayDiff(reunionDate) : null;
    const daysRemaining = daysDiff == null ? null : Math.max(0, daysDiff);
    const location =
      partner?.meetingLocation ?? partner?.location?.city ?? null;
    const partnerFirstName =
      partner?.firstName ?? partner?.name?.trim().split(/\s+/)[0] ?? null;
    const calendarPayload = { daysRemaining, reunionDate, location, partnerFirstName };
    await FileSystem.writeAsStringAsync(
      `${baseUri}/calendar.json`,
      JSON.stringify(calendarPayload)
    );
    reloadWidget();
  } catch (e) {
    console.error('Widget data write:', e?.message || e);
    reloadWidget();
  }
}

const APP_GROUP_ID = 'group.com.edmond.duva';

/**
 * Sync the widget photo: download to cache first, then copy into the App Group so
 * the native widget extension can read it. Uses a two-step approach because
 * downloadAsync can silently fail when targeting App Group paths directly.
 */
export async function syncWidgetPhoto(photoUrl, caption = '') {
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) {
      console.warn('[syncWidgetPhoto] App Group directory unavailable');
      return;
    }
    const destUri = 'file://' + sharedPath + '/current_widget_photo.jpg';
    const captionUri = 'file://' + sharedPath + '/current_widget_photo_caption.txt';

    if (!photoUrl) {
      try {
        const info = await FileSystem.getInfoAsync(destUri, { size: false });
        if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch (_) {}
      try {
        const captionInfo = await FileSystem.getInfoAsync(captionUri, { size: false });
        if (captionInfo.exists) await FileSystem.deleteAsync(captionUri, { idempotent: true });
      } catch (_) {}
      reloadWidget();
      return;
    }

    // Step 1: download to the app's own cache (guaranteed to work)
    const cacheUri = FileSystem.cacheDirectory + 'widget_photo_tmp.jpg';
    const dl = await FileSystem.downloadAsync(photoUrl, cacheUri);
    if (!dl || dl.status !== 200) {
      console.warn('[syncWidgetPhoto] download failed, status', dl?.status);
      return;
    }

    // Step 2: copy from cache into the App Group shared container
    try {
      const existing = await FileSystem.getInfoAsync(destUri, { size: false });
      if (existing.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
    } catch (_) {}
    await FileSystem.copyAsync({ from: cacheUri, to: destUri });

    // Verify the file actually landed
    const verify = await FileSystem.getInfoAsync(destUri, { size: false });
    if (!verify.exists) {
      console.error('[syncWidgetPhoto] file not found after copy — App Group write failed');
      return;
    }

    const normalizedCaption = typeof caption === 'string' ? caption.trim().slice(0, 120) : '';
    if (normalizedCaption) {
      await FileSystem.writeAsStringAsync(captionUri, normalizedCaption);
    } else {
      try {
        const captionInfo = await FileSystem.getInfoAsync(captionUri, { size: false });
        if (captionInfo.exists) await FileSystem.deleteAsync(captionUri, { idempotent: true });
      } catch (_) {}
    }

    reloadWidget();
  } catch (e) {
    console.error('[syncWidgetPhoto]', e?.message || e);
  }
}

/**
 * Sync the calendar widget background photo: copy a local file (e.g. from ImagePicker)
 * into the App Group as calendar_widget_photo.jpg so the DuvaCalendarWidget can show it blurred.
 * Uses base64 read/write for reliable cross-container copy on iOS.
 */
export async function syncCalendarWidgetPhoto(localUri) {
  try {
    const sharedPath = getAppGroupDirectory(APP_GROUP_ID);
    if (!sharedPath) {
      console.warn('[syncCalendarWidgetPhoto] App Group directory unavailable');
      return false;
    }
    const destUri = 'file://' + sharedPath + '/calendar_widget_photo.jpg';

    if (!localUri || typeof localUri !== 'string' || localUri.trim() === '') {
      try {
        const info = await FileSystem.getInfoAsync(destUri, { size: false });
        if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch (_) {}
      reloadWidget();
      return true;
    }

    // Downscale for WidgetKit archival limits before writing to App Group.
    // Keep area safely below the ~1.07M px threshold that causes archival failures.
    const processed = await manipulateAsync(
      localUri,
      [{ resize: { width: 1000, height: 1000 } }],
      { format: SaveFormat.JPEG, compress: 0.82 }
    );
    const sourceUri = processed?.uri || localUri;
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    try {
      const existing = await FileSystem.getInfoAsync(destUri, { size: false });
      if (existing.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
    } catch (_) {}
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    reloadWidget();
    return true;
  } catch (e) {
    console.error('[syncCalendarWidgetPhoto]', e?.message || e);
    return false;
  }
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
    /** True while the dove-carry send animation is playing (before real upload). */
    isAnimatingSend: false,
    /** True while the actual photo upload (S3 + backend) is in progress. */
    isSendingPhoto: false,
    /** Photos sent by current user in last 24h (for History modal). */
    todaysPhotos: [],

    setAnimatingSend: (value) => set({ isAnimatingSend: value }),
    setSendingPhoto: (value) => set({ isSendingPhoto: value }),

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

    /** Optimistically set hasPremiumAccess (e.g. after purchase, before webhook). Lets user past the gate immediately. */
    setHasPremiumAccessOptimistic: (value) => set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, hasPremiumAccess: Boolean(value) };
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return { user };
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
            stitchOnboardingIfPresent();
            // Register for push and send token to backend
            registerForPushNotificationsAsync().then((token) => {
              if (token) updatePushToken(token).catch(() => {});
            });
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
        // Push an initial widget snapshot so the home screen widget shows the placeholder instead of blank
        if (PartnerPictureWidget?.updateSnapshot) {
          try {
            PartnerPictureWidget.updateSnapshot({
              partnerName: 'Your partner',
              moodEmoji: '💭',
              hasNewPhoto: false,
              partnerTime: '--:--',
              partnerWeather: '--°',
            });
          } catch (_) {}
        }
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
      const parsedName = parseFullName(nameFromOAuth);
      if (typeof nameFromOAuth === 'string' && nameFromOAuth.trim()) {
        body.name = nameFromOAuth.trim();
      }
      if (parsedName.firstName) {
        body.firstName = parsedName.firstName;
      }
      if (parsedName.lastName) {
        body.lastName = parsedName.lastName;
      }
      const { data } = await api.post('/auth/oauth', body);
      const user = normalizeUser(data.user);
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setApiToken(data.token);
      set({ token: data.token, user, partnerId: user.partnerId });
      stitchOnboardingIfPresent();
      // Register for push and send token to backend
      registerForPushNotificationsAsync().then((token) => {
        if (token) updatePushToken(token).catch(() => {});
      });
    },

    /**
     * Sign in with Apple: runs native Apple flow, then POSTs to backend and saves token/user.
     * Apple returns fullName and email only on the first successful login; we send them when present.
     */
    signInWithApple: async () => {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error('No identity token from Apple');
        }
        const fullName =
          credential.fullName &&
          [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ')
            .trim();
        const email =
          typeof credential.email === 'string' && credential.email.trim()
            ? credential.email.trim()
            : undefined;
        const body = {
          provider: 'apple',
          identityToken: credential.identityToken,
        };
        if (fullName) body.name = fullName;
        if (credential.fullName?.givenName) body.firstName = credential.fullName.givenName.trim();
        if (credential.fullName?.familyName) body.lastName = credential.fullName.familyName.trim();
        if (email) body.email = email;
        const { data } = await api.post('/auth/oauth', body);
        const user = normalizeUser(data.user);
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        setApiToken(data.token);
        set({ token: data.token, user, partnerId: user.partnerId ?? null });
        stitchOnboardingIfPresent();
        registerForPushNotificationsAsync().then((token) => {
          if (token) updatePushToken(token).catch(() => {});
        });
      } catch (err) {
        if (err.code === 'ERR_REQUEST_CANCELED') {
          const cancelError = new Error('Sign in canceled');
          cancelError.code = 'ERR_REQUEST_CANCELED';
          throw cancelError;
        }
        throw err;
      }
    },

    /** Fetch partner profile (GET /api/user/partner) and save to store. */
    fetchPartner: async () => {
      const { partnerId } = get();
      if (!partnerId) return null;
      try {
        const data = await getPartner();
        const partnerParsed = parseFullName(data.partner?.name);
        const partnerFirstName = data.partner?.firstName ?? partnerParsed.firstName;
        const partnerLastName = data.partner?.lastName ?? partnerParsed.lastName;
        const partner = data.partner
          ? {
              id: data.partner.id,
              firstName: partnerFirstName ?? undefined,
              lastName: partnerLastName ?? undefined,
              name: buildFullName(partnerFirstName, partnerLastName) ?? data.partner.name ?? undefined,
              email: data.partner.email ?? undefined,
              location: data.partner.location,
              batteryLevel: data.partner.batteryLevel ?? null,
              lastUpdatedDataAt: data.partner.lastUpdatedDataAt ?? null,
              lastActive: data.partner.lastActive ?? null,
              nextMeetingDate: data.partner.nextMeetingDate ?? null,
              meetingLocation: data.partner.meetingLocation ?? undefined,
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
        const photos = partner?.photos ?? [];
        const latestPhoto =
          photos.length > 0
            ? [...photos].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
            : null;
        let hasFreshPhoto = false;
        if (latestPhoto && latestPhoto.createdAt) {
          const photoTime = new Date(latestPhoto.createdAt).getTime();
          const now = Date.now();
          const isExpired = now - photoTime > 24 * 60 * 60 * 1000;
          hasFreshPhoto = !isExpired;
        }
        if (PartnerPictureWidget?.updateSnapshot) {
          try {
            const tz = partner?.timezone || 'UTC';
            const formattedTime =
              typeof Intl !== 'undefined' && Intl.DateTimeFormat
                ? new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  }).format(new Date())
                : '--';
            PartnerPictureWidget.updateSnapshot({
              partnerName: partner?.name || 'Your partner',
              moodEmoji: partner?.mood?.emoji || '💭',
              hasNewPhoto: hasFreshPhoto,
              partnerTime: formattedTime,
              partnerWeather: partner?.location?.weather ?? '--°',
            });
          } catch (e) {
            console.error('Failed to update widget:', e);
          }
        }
        await writeWidgetData(partner, partner?.reunion ?? null);
        const activePhotoUrl = latestPhoto?.thumbnailUrl || latestPhoto?.url;
        await syncWidgetPhoto(activePhotoUrl, latestPhoto?.caption ?? '');
        return partner;
      } catch {
        return null;
      }
    },

    /** Update profile (first/last name) and sync store. */
    updateProfileName: async (firstName, lastName = '') => {
      const data = await updateProfile({
        firstName: typeof firstName === 'string' ? firstName.trim() : '',
        lastName: typeof lastName === 'string' ? lastName.trim() : '',
      });
      const user = normalizeUser(data.user);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set((state) => ({ user, partnerId: user.partnerId ?? state.partnerId }));
      return user;
    },

    /** Unlink from partner (POST /api/couple/unlink). Clears partnerId on both users; updates store and SecureStore so router redirects to pair/paywall. */
    unlinkPartner: async () => {
      await apiUnlinkPartner();
      const { user } = get();
      const updatedUser = user ? { ...user, partnerId: null } : null;
      if (updatedUser) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      set({ partnerId: null, partner: null, user: updatedUser });
    },

    /** Set reunion dates for both users; updates local user and partner state. */
    saveReunion: async (startDate, endDate) => {
      const data = await apiSaveReunion(startDate, endDate);
      const reunion = normalizeReunion(data.reunion);
      set((state) => ({
        user: state.user ? { ...state.user, reunion } : null,
        partner: state.partner ? { ...state.partner, reunion } : null,
      }));
      const { user, partner } = get();
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      await writeWidgetData(partner, reunion);
      return reunion;
    },

    /** Clear reunion for both users (end visit). */
    endReunion: async () => {
      await apiEndReunion();
      set((state) => ({
        user: state.user ? { ...state.user, reunion: null } : null,
        partner: state.partner ? { ...state.partner, reunion: null } : null,
      }));
      const { user, partner } = get();
      if (user) SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      await writeWidgetData(partner, null);
    },

    /** Refresh stats widget with optional location, partnerTime, weather (for Duva Stats widget). Call from home when weather/partner time are available. */
    refreshStatsWidget: async (statsExtras) => {
      const { partner, user } = get();
      await writeWidgetData(partner, user?.reunion ?? null, statsExtras);
    },

    /** Register a photo URL and optional caption after S3 upload; updates user.photos in store. */
    addPhotoAfterUpload: async (finalUrl, caption = '') => {
      const data = await addUserPhoto(finalUrl, caption);
      set((state) => ({
        user: state.user ? { ...state.user, photos: data.photos ?? [] } : null,
      }));
      return data.photos;
    },

    /** Fetch today's photos (last 24h) for History modal. */
    fetchTodaysPhotos: async () => {
      try {
        const photos = await getTodaysPhotos();
        set({ todaysPhotos: photos ?? [] });
        return photos ?? [];
      } catch {
        set({ todaysPhotos: [] });
        return [];
      }
    },

    /** Delete a photo. Optimistic update: remove from todaysPhotos first, then call API. No refetch to avoid layout flash. */
    deletePhotoFromToday: async (photoId) => {
      set((state) => ({
        todaysPhotos: (state.todaysPhotos ?? []).filter((p) => p.id !== photoId),
      }));
      try {
        await apiDeletePhoto(photoId);
      } catch (e) {
        console.error('[deletePhoto]', e?.message || e);
        get().fetchTodaysPhotos();
      }
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
