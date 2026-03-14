import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { useAuthStore } from '../src/store/useAuthStore';
import { syncSubscription } from '../src/lib/api';
import { colors } from '../src/theme/colors';
import { registerBackgroundWidgetTask } from '../src/lib/backgroundWidgetTask';

// Load widget and push initial snapshot so home screen widget shows placeholder instead of blank
let PartnerPictureWidget;
try {
  PartnerPictureWidget = require('../targets/widget/PartnerPictureWidget').default;
} catch {
  PartnerPictureWidget = null;
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.blushDark} />
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const initAuth = useAuthStore((s) => s.initAuth);
  const isAuthLoading = useAuthStore((s) => s.isAuthLoading);
  const sessionVerified = useAuthStore((s) => s.sessionVerified);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [fontsLoaded] = useFonts({
    PermanentMarker_400Regular,
  });

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Set notification handler when expo-notifications is available (e.g. dev build); no-op in Expo Go if module missing
  useEffect(() => {
    try {
      const Notifications = require('expo-notifications');
      if (Notifications?.setNotificationHandler) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      }
    } catch (_) {
      // Native module (ExpoPushTokenManager) not available in this environment
    }
  }, []);

  // Register background task for widget update on silent push (new photo)
  useEffect(() => {
    try {
      registerBackgroundWidgetTask();
    } catch (_) {}
  }, []);

  // Sync widget with current partner photo whenever app comes to foreground
  const fetchPartner = useAuthStore((s) => s.fetchPartner);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') fetchPartner();
    });
    return () => sub.remove();
  }, [fetchPartner]);

  // Cold start: sync widget as soon as we're logged in with a partner (AppState 'change' only fires on transition, not initial load)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!sessionVerified || !token || !user?.partnerId) return;
    fetchPartner();
  }, [sessionVerified, token, user?.partnerId, fetchPartner]);

  // Push initial widget snapshot on mount so the widget has content (placeholder) to show
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
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
  }, []);

  const setHasPremiumAccessOptimistic = useAuthStore((s) => s.setHasPremiumAccessOptimistic);

  useEffect(() => {
    const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
    if (!isNative || !apiKey || !Purchases) return;
    try {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      Purchases.configure({ apiKey });
    } catch (e) {
      // Native module may be unavailable (e.g. Expo Go, web); fail silently
      if (__DEV__) console.warn('RevenueCat init skipped:', e?.message ?? e);
    }
  }, []);

  useEffect(() => {
    if (!Purchases) return;
    const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'premium';
    const onCustomerInfoUpdated = (customerInfo) => {
      const hasEntitlement = customerInfo?.entitlements?.active?.[entitlementId] != null;
      if (hasEntitlement) {
        setHasPremiumAccessOptimistic(true);
        router.replace('/');
      }
    };
    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdated);
    };
  }, [router, setHasPremiumAccessOptimistic]);

  /** Self-healing: on launch, if RevenueCat says user has entitlement but backend does not, sync and unblock. */
  useEffect(() => {
    const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
    if (!isNative || !Purchases || !sessionVerified || !token || !user?.id) return;

    const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'premium';

    (async () => {
      try {
        await Purchases.logIn(user.id);
        const customerInfo = await Purchases.getCustomerInfo();
        const isRcPremium = typeof customerInfo?.entitlements?.active?.[entitlementId] !== 'undefined';

        if (isRcPremium && user.hasPremiumAccess !== true) {
          setHasPremiumAccessOptimistic(true);
          syncSubscription().catch(() => {});
        }
      } catch (_) {}
    })();
  }, [sessionVerified, token, user?.id, user?.hasPremiumAccess, setHasPremiumAccessOptimistic]);

  // Only run redirect after auth has finished loading; unauthenticated users start at onboarding
  useEffect(() => {
    if (isAuthLoading) return;
    if (!sessionVerified) return;
    if (!token || !user) router.replace('/onboarding');
  }, [isAuthLoading, sessionVerified, token, user, router]);

  if (!fontsLoaded || isAuthLoading) {
    return (
      <>
        <StatusBar style="dark" />
        <SplashScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFF8F5' },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
