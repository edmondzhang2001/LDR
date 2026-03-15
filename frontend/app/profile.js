import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { Button } from '../src/components/Button';
import { colors } from '../src/theme/colors';

const RADIUS = 28;
function parseName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const SHADOW = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 1,
  shadowRadius: 16,
  elevation: 6,
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfileName = useAuthStore((s) => s.updateProfileName);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { firstName: f, lastName: l } = parseName(user?.name);
    setFirstName(f);
    setLastName(l);
  }, [user?.name]);

  useEffect(() => {
    if (user?.name) router.replace('/');
  }, [user?.name, router]);

  const handleContinue = async () => {
    const f = firstName.trim();
    if (!f) {
      setError('Please enter your first name');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fullName = [f, lastName.trim()].filter(Boolean).join(' ');
      await updateProfileName(fullName);
      router.replace('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="person" size={44} color={colors.blushDark} />
          </View>
        </View>
        <Text style={styles.title}>What should your partner call you?</Text>
        <Text style={styles.subtitle}>
          Enter your name—something cozy they’ll see in the app.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={colors.textMuted}
          value={firstName}
          onChangeText={(t) => {
            setFirstName(t);
            if (error) setError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          placeholder="Last name (optional)"
          placeholderTextColor={colors.textMuted}
          value={lastName}
          onChangeText={(t) => {
            setLastName(t);
            if (error) setError('');
          }}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Continue"
          onPress={handleContinue}
          loading={loading}
          disabled={!firstName.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
  },
  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 22,
    fontSize: 17,
    color: colors.text,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.blush + '80',
    ...SHADOW,
  },
  error: {
    fontSize: 14,
    color: colors.blushDark,
    textAlign: 'center',
    marginBottom: 12,
  },
});
