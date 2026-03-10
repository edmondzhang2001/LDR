import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Purchases from 'react-native-purchases';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

// Configure Google Sign-In. On iOS both webClientId and iosClientId are required (no GoogleService-Info.plist).
// Get them from Google Cloud Console: create OAuth 2.0 Client IDs (Web + iOS). Backend uses webClientId to verify the token.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleConfigured =
  Platform.OS === 'web' ||
  (webClientId && (Platform.OS !== 'ios' || iosClientId));
if (googleConfigured && Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' ? { iosClientId } : {}),
  });
}

const RADIUS = 24;
const SHADOW = {
  shadowColor: colors.shadowStrong,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 4,
};

export default function AuthScreen() {
  const router = useRouter();
  const signInWithOAuth = useAuthStore((s) => s.signInWithOAuth);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const handleAppleSignIn = async () => {
    setError('');
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('No identity token from Apple');
      }
      const fullName =
        credential.fullName &&
        [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ')
          .trim();
      await signInWithOAuth('apple', credential.identityToken, fullName || undefined);
      await refreshUser();
      const mongoUserId = useAuthStore.getState().user?.id;
      if (Purchases && mongoUserId) {
        try {
          await Purchases.logIn(mongoUserId);
        } catch (_) {}
      }
      // Route to app; index will send non‑premium users to paywall screen (where they can subscribe or enter partner code).
      router.replace('/');
    } catch (err) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const message =
        err.response?.data?.error ||
        err.message ||
        'Sign in with Apple failed';
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    if (!googleConfigured) {
      setError(
        'Google Sign-In not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in app config.'
      );
      return;
    }
    setLoading('google');
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken =
        signInResult?.data?.idToken ?? signInResult?.idToken ?? null;
      if (!idToken) {
        if (signInResult?.user === undefined && !signInResult?.data) {
          return;
        }
        throw new Error(
          'No identity token from Google. Ensure GoogleSignin is configured with webClientId.'
        );
      }
      const userInfo = signInResult?.data?.user ?? signInResult?.user;
      const nameFromGoogle = (userInfo?.name ?? [userInfo?.givenName, userInfo?.familyName].filter(Boolean).join(' ').trim()) || undefined;
      await signInWithOAuth('google', idToken, nameFromGoogle);
      await refreshUser();
      const mongoUserId = useAuthStore.getState().user?.id;
      if (Purchases && mongoUserId) {
        try {
          await Purchases.logIn(mongoUserId);
        } catch (_) {}
      }
      // Route to app; index will send non‑premium users to paywall screen (where they can subscribe or enter partner code).
      router.replace('/');
    } catch (err) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      const message =
        err.response?.data?.error ||
        err.message ||
        'Sign in with Google failed';
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  const busy = loading !== null;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="heart" size={48} color={colors.blushDark} />
        </View>
      </View>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>
        Sign in to stay connected with your partner
      </Text>

      <View style={styles.buttons}>
        {Platform.OS === 'ios' && appleAvailable && (
          <TouchableOpacity
            style={[styles.btn, styles.appleBtn]}
            onPress={handleAppleSignIn}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loading === 'apple' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={24} color={colors.white} />
                <Text style={styles.appleBtnText}>Sign in with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btn, styles.googleBtn, !googleConfigured && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={busy || !googleConfigured}
          activeOpacity={0.85}
        >
          {loading === 'google' ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={22} color={colors.text} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    paddingTop: 100,
  },
  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  buttons: { gap: 16 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    paddingVertical: 18,
    minHeight: 58,
    gap: 12,
    ...SHADOW,
  },
  appleBtn: {
    backgroundColor: '#000',
  },
  appleBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  googleBtn: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.blush,
  },
  googleBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  error: {
    fontSize: 14,
    color: colors.blushDark,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
