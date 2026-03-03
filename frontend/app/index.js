import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

export default function Index() {
  const router = useRouter();
  const { token, partnerId, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/auth');
      return;
    }
    if (partnerId == null) {
      router.replace('/pair');
      return;
    }
    router.replace('/home');
  }, [hydrated, token, partnerId, router]);

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
