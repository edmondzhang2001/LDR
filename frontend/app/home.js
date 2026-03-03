import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { colors } from '../src/theme/colors';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="heart" size={48} color={colors.blushDark} />
      </View>
      <Text style={styles.title}>You’re all set</Text>
      <Text style={styles.subtitle}>You’re paired and ready. More features coming soon.</Text>
      {user?.email ? (
        <Text style={styles.email}>{user.email}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
});
