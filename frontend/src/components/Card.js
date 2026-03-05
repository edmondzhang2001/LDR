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

export function Card({ children, style, glass }) {
  return (
    <View style={[styles.card, glass && styles.cardGlass, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS,
    padding: 24,
    ...SHADOW,
  },
  cardGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});
