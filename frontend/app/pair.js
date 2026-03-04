import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { generatePairCode, joinPair } from '../src/lib/api';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { colors } from '../src/theme/colors';

const POLL_INTERVAL_MS = 3000;

export default function PairScreen() {
  const router = useRouter();
  const { partnerId, setPartnerId, refreshUser, logout } = useAuthStore();
  const [generatedCode, setGeneratedCode] = useState(null);
  const [joinCode, setJoinCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const pollRef = useRef(null);

  // Guard: paired users must not see pairing screen
  useEffect(() => {
    if (partnerId != null) router.replace('/home');
  }, [partnerId, router]);

  // When code is shown, poll /auth/me every 3s until partnerId is set (then guard redirects to dashboard)
  useEffect(() => {
    if (!generatedCode) return;
    const poll = async () => {
      const user = await refreshUser();
      if (user?.partnerId != null) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [generatedCode, refreshUser]);

  const handleGenerate = async () => {
    setError('');
    setGenerateLoading(true);
    try {
      const data = await generatePairCode();
      setGeneratedCode(data.code);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate code');
    } finally {
      setGenerateLoading(false);
    }
  };

  const joinCodeStr = joinCode.join('');
  const handleJoin = async () => {
    setError('');
    if (joinCodeStr.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setJoinLoading(true);
    try {
      const data = await joinPair(joinCodeStr);
      setPartnerId(data.partnerId);
      router.replace('/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  const setJoinCodeAt = (index, char) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = [...joinCode];
    next[index] = digit;
    setJoinCode(next);
  };
  const otpInputRefs = useRef([]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={44} color={colors.skyDark} />
          </View>
        </View>
        <Text style={styles.title}>Link with your partner</Text>
        <Text style={styles.subtitle}>Generate a code or enter your partner’s code to connect.</Text>

        {/* Top half: Generate */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Generate connection code</Text>
          <Text style={styles.sectionHint}>Your partner will enter this code in their app.</Text>
          {!generatedCode ? (
            <Button title="Generate 6-digit code" onPress={handleGenerate} loading={generateLoading} />
          ) : (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{generatedCode}</Text>
              </View>
              <Text style={styles.codeExpiry}>Expires in 10 minutes. Waiting for partner…</Text>
              <TouchableOpacity style={styles.textButton} onPress={() => { setGeneratedCode(null); setError(''); }}>
                <Text style={styles.textButtonLabel}>Generate a new code</Text>
              </TouchableOpacity>
            </>
          )}
          {error && !joinCodeStr ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        {/* Bottom half: Join */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Enter partner’s code</Text>
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
                  if (nativeEvent.key === 'Backspace' && !joinCode[i] && i > 0) otpInputRefs.current[i - 1]?.focus();
                }}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
          <Button title="Connect" onPress={handleJoin} loading={joinLoading} disabled={joinCodeStr.length !== 6} />
          {error && joinCodeStr ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        <TouchableOpacity style={styles.logoutWrap} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  sectionCard: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: colors.cream,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.blush + '80',
  },
  codeText: { fontSize: 40, fontWeight: '800', letterSpacing: 10, color: colors.blushDark },
  codeExpiry: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  textButton: { alignSelf: 'center' },
  textButtonLabel: { fontSize: 15, color: colors.skyDark, fontWeight: '600' },
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
  error: { fontSize: 14, color: colors.blushDark, marginTop: 12, textAlign: 'center' },
  logoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
    gap: 8,
  },
  logoutText: { fontSize: 15, color: colors.textMuted },
});
