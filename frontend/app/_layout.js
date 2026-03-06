import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Only run redirect after auth has finished loading; unauthenticated users start at onboarding
  useEffect(() => {
    if (isAuthLoading) return;
    if (!sessionVerified) return;
    if (!token || !user) router.replace('/onboarding');
  }, [isAuthLoading, sessionVerified, token, user, router]);

  if (isAuthLoading) {
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
