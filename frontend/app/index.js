import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

export default function Index() {
  const router = useRouter();
  const { token, partnerId, hydrated, refreshUser } = useAuthStore();
  const guardDone = useRef(false);

  useEffect(() => {
    if (!hydrated || guardDone.current) return;
    let cancelled = false;

    (async () => {
      if (!token) {
        router.replace('/auth');
        guardDone.current = true;
        return;
      }
      await refreshUser();
      if (cancelled) return;
      const state = useAuthStore.getState();
      const u = state.user;
      const p = state.partnerId;
      guardDone.current = true;
      if (!u) router.replace('/auth');
      else if (p == null) router.replace('/pair');
      else router.replace('/home');
    })();

    return () => { cancelled = true; };
  }, [hydrated, token, router, refreshUser]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.blushDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
