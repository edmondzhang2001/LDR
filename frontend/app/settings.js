import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

const RADIUS = 24;
const SHADOW = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 4,
};

function parseName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, partnerId, updateProfileName, logout, unlinkPartner } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    const { firstName: f, lastName: l } = parseName(user?.name);
    setFirstName(f);
    setLastName(l);
  }, [user?.name]);

  const performSaveName = async (f, l) => {
    const newName = [f.trim(), l.trim()].filter(Boolean).join(' ');
    if (!newName || newName === user?.name) return;
    setNameSaving(true);
    try {
      await updateProfileName(newName);
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg && typeof msg === 'string' && msg.includes('14 days')) {
        Alert.alert('Name change limit', msg);
      } else {
        Alert.alert('Error', 'Could not save name. Please try again.');
      }
    } finally {
      setNameSaving(false);
    }
  };

  const handleSaveName = () => {
    const f = firstName.trim();
    const l = lastName.trim();
    const newName = [f, l].filter(Boolean).join(' ');
    if (!newName || newName === user?.name) return;
    Alert.alert(
      'Confirm Name Change',
      `Are you sure you want to change your name to '${newName}'? You can only do this once every 14 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'default', onPress: () => performSaveName(f, l) },
      ]
    );
  };

  const performUnlink = async () => {
    try {
      await unlinkPartner();
      router.replace('/pair');
    } catch (_) {
      Alert.alert('Error', 'Could not unlink. Please try again.');
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Partner',
      'Are you sure you want to disconnect from your partner? You will lose access to your shared connection and will need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlink', style: 'destructive', onPress: () => performUnlink() },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  if (!user) return null;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Settings',
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Change Name */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Display name</Text>
            <View style={styles.nameInputs}>
              <TextInput
                style={styles.nameInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                editable={!nameSaving}
              />
              <TextInput
                style={[styles.nameInput, { marginTop: 12 }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                editable={!nameSaving}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.saveNameButton,
                pressed && styles.buttonPressed,
                nameSaving && styles.saveNameButtonDisabled,
              ]}
              onPress={handleSaveName}
              disabled={
                nameSaving ||
                !firstName.trim() ||
                [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') === user?.name
              }
            >
              {nameSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveNameText}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Unlink Partner — destructive look (red outline), only when paired */}
          {partnerId ? (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.unlinkButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleUnlink}
            >
              <Ionicons name="link-outline" size={22} color={colors.blushDark} />
              <Text style={styles.unlinkText}>Unlink Partner</Text>
            </Pressable>
          ) : null}

          {/* Logout — standard secondary style */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.logoutButton, pressed && styles.buttonPressed]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  headerBack: {
    padding: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    ...SHADOW,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  nameInputs: {
    marginBottom: 16,
  },
  nameInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  saveNameButton: {
    backgroundColor: colors.blushDark,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS,
  },
  saveNameButtonDisabled: {
    opacity: 0.6,
  },
  saveNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  unlinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.blushDark,
  },
  unlinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.blushDark,
  },
});
