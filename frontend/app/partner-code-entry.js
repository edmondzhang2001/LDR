import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { joinPair } from '../src/lib/api';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { colors } from '../src/theme/colors';

export default function PartnerCodeEntryScreen() {
  const router = useRouter();
  const { setPartnerId, setHasPremiumAccessOptimistic, refreshUser } = useAuthStore();
  const [joinCode, setJoinCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const otpInputRefs = useRef([]);

  const joinCodeStr = joinCode.join('');

  const setJoinCodeAt = (index, char) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = [...joinCode];
    next[index] = digit;
    setJoinCode(next);
  };

  const handleConnect = async () => {
    setError('');
    if (joinCodeStr.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setJoinLoading(true);
    try {
      const data = await joinPair(joinCodeStr);
      setPartnerId(data.partnerId);
      await refreshUser();

      if (data.hasPremiumAccess === true) {
        setHasPremiumAccessOptimistic(true);
        router.replace('/');
      } else {
        router.replace('/paywall');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={40} color={colors.skyDark} />
            </View>
          </View>
          <Text style={styles.title}>Enter partner's code</Text>
          <Text style={styles.subtitle}>
            Your paying partner can find this 6-digit code in their app. Enter it below to get shared access.
          </Text>

          <Card style={styles.card}>
            <Text style={styles.sectionHint}>Type the 6-digit code your partner shared.</Text>
            <View style={styles.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <TextInput
                  key={i}
                  ref={(r) => (otpInputRefs.current[i] = r)}
                  style={[styles.otpCell, joinCode[i] && styles.otpCellFilled]}
                  value={joinCode[i]}
                  onChangeText={(t) => {
                    setJoinCodeAt(i, t);
                    if (t && i < 5) otpInputRefs.current[i + 1]?.focus();
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !joinCode[i] && i > 0) {
                      otpInputRefs.current[i - 1]?.focus();
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>
            <Button
              title="Connect"
              onPress={handleConnect}
              loading={joinLoading}
              disabled={joinCodeStr.length !== 6}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.blush + '80',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    marginBottom: 24,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.blush + '60',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    padding: 0,
  },
  otpCellFilled: {
    borderColor: colors.blushDark,
    backgroundColor: colors.surface,
  },
  error: {
    fontSize: 14,
    color: colors.blushDark,
    marginTop: 12,
    textAlign: 'center',
  },
});
