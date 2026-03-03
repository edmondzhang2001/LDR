import { View, TextInput, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const RADIUS = 20;
const SHADOW = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 4,
};

export function Input({ label, value, onChangeText, placeholder, secureTextEntry, error, autoCapitalize = 'none', autoCorrect = false, keyboardType }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    ...SHADOW,
  },
  inputError: { borderWidth: 1, borderColor: colors.blushDark },
  errorText: { fontSize: 13, color: colors.blushDark, marginTop: 4 },
});
