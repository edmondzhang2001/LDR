import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Compact frosted pill for Immersive Mode. Use pastel icons + colors.text for readability.
 */
export function GlassPill({ children, style }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
});
