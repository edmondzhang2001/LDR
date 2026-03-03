import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const RADIUS = 24;
const SHADOW = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 1,
  shadowRadius: 16,
  elevation: 6,
};

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS,
    padding: 24,
    ...SHADOW,
  },
});
