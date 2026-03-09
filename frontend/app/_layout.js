import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

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
