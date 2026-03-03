import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

const RADIUS = 24;
const SHADOW = {
  shadowColor: colors.shadowStrong,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 4,
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.blushDark} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...SHADOW,
  },
  primary: { backgroundColor: colors.blushDark },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.blush },
  disabled: { opacity: 0.6 },
  text: { fontSize: 17, fontWeight: '600' },
  textPrimary: { color: colors.white },
  textSecondary: { color: colors.text },
});
