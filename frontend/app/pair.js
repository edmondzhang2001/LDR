import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { api } from '../src/lib/api';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { colors } from '../src/theme/colors';

export default function PairScreen() {
  const router = useRouter();
  const { user, setPartnerId, logout } = useAuthStore();
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/couple/pair/generate');
      setGeneratedCode(data.code);
      setMode('show');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/couple/pair/join', { code: trimmed });
      setPartnerId(data.partnerId);
      router.replace('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/auth');
  };

  if (mode === null) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={44} color={colors.skyDark} />
            </View>
          </View>
          <Text style={styles.title}>Link with your partner</Text>
          <Text style={styles.subtitle}>
            Generate a code for your partner to enter, or enter their code to pair.
          </Text>

          <Card style={styles.card}>
            <TouchableOpacity style={styles.option} onPress={() => setMode('generate')}>
              <Ionicons name="key" size={24} color={colors.blushDark} />
              <Text style={styles.optionText}>I’ll generate a code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => setMode('enter')}>
              <Ionicons name="key" size={24} color={colors.skyDark} />
              <Text style={styles.optionText}>I have my partner’s code</Text>
            </TouchableOpacity>
          </Card>

          <TouchableOpacity style={styles.logoutWrap} onPress={handleLogout}>
            <Ionicons name="log-out" size={18} color={colors.textMuted} />
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (mode === 'show' && generatedCode) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Your pairing code</Text>
          <Text style={styles.subtitle}>Share this code with your partner. It expires in 10 minutes.</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{generatedCode}</Text>
          </View>
          <TouchableOpacity style={styles.backLink} onPress={() => { setMode(null); setGeneratedCode(null); setError(''); }}>
            <Text style={styles.link}>Generate a new code</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (mode === 'generate') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Generate code</Text>
          <Text style={styles.subtitle}>Your partner will enter this code in their app.</Text>
          <Card style={styles.card}>
            <Button title="Generate 6-digit code" onPress={handleGenerate} loading={loading} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
          <TouchableOpacity style={styles.backLink} onPress={() => { setMode(null); setError(''); }}>
            <Text style={styles.link}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter partner’s code</Text>
        <Text style={styles.subtitle}>Type the 6-digit code your partner generated.</Text>
        <Card style={styles.card}>
          <Input
            label="6-digit code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Pair" onPress={handleJoin} loading={loading} />
        </Card>
        <TouchableOpacity style={styles.backLink} onPress={() => { setMode(null); setCode(''); setError(''); }}>
          <Text style={styles.link}>Back</Text>
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
    paddingTop: 80,
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
  card: { marginBottom: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.blush + '40',
  },
  optionText: { fontSize: 17, color: colors.text, marginLeft: 14, fontWeight: '600' },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  codeText: { fontSize: 42, fontWeight: '700', letterSpacing: 8, color: colors.text },
  error: { fontSize: 14, color: colors.blushDark, marginTop: 12, textAlign: 'center' },
  backLink: { alignSelf: 'center', marginTop: 8 },
  link: { fontSize: 15, color: colors.skyDark, fontWeight: '600' },
  logoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 32,
    gap: 8,
  },
  logoutText: { fontSize: 15, color: colors.textMuted },
});
