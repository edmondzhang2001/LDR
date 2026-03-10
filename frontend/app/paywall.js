import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { syncSubscription } from '../src/lib/api';
import { colors } from '../src/theme/colors';

const RADIUS = 24;

export default function PaywallScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const setHasPremiumAccessOptimistic = useAuthStore((s) => s.setHasPremiumAccessOptimistic);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(false);
  const [isVerifyingPurchase, setIsVerifyingPurchase] = useState(false);

  const handleSuccessfulPurchase = async () => {
    setIsVerifyingPurchase(true);
    try {
      const user = await refreshUser();
      if (user?.hasPremiumAccess) {
        router.replace('/');
        return;
      }
      setHasPremiumAccessOptimistic(true);
      syncSubscription().catch(() => {});
      router.replace('/');
    } finally {
      setIsVerifyingPurchase(false);
    }
  };

  const handleOpenPaywall = async () => {
    setLoading(true);
    try {
      const paywallResult = await RevenueCatUI.presentPaywall();
      if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
        await handleSuccessfulPurchase();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart" size={48} color={colors.blushDark} />
        </View>
        <Text style={styles.title}>Unlock LDR</Text>
        <Text style={styles.subtitle}>
          Subscribe to stay connected with your partner—shared calendar, live status, and puffy postcards delivered by dove.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, (loading || isVerifyingPurchase) && styles.primaryButtonDisabled]}
          onPress={handleOpenPaywall}
          disabled={loading || isVerifyingPurchase}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : isVerifyingPurchase ? (
            <View style={styles.primaryButtonVerifying}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.primaryButtonText}>Verifying…</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>View subscription options</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => logout()} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: colors.blushDark,
    borderRadius: RADIUS,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonVerifying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
