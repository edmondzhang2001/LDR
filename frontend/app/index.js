import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

export default function Index() {
  const router = useRouter();
  const { user, token, partnerId, sessionVerified } = useAuthStore();
  const guardDone = useRef(false);

  useEffect(() => {
    if (!sessionVerified || guardDone.current) return;
    guardDone.current = true;

    if (!token || !user) {
      router.replace('/auth');
      return;
    }
    if (!user.name) {
      router.replace('/profile');
      return;
    }
    if (partnerId == null) {
      router.replace('/pair');
      return;
    }
    router.replace('/home');
  }, [sessionVerified, token, user, partnerId, router]);

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
