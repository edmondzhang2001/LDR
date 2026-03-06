import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const DOVE_WHITE = '#FFFBF8';
const DOVE_SHADOW = 'rgba(232, 180, 184, 0.35)';

/**
 * Cute cartoon dove (pastel white) for the send animation.
 * leftWingRotation / rightWingRotation can be Animated.Value (e.g. -1..1) or number (degrees).
 */
export function Dove({ size = 56, leftWingRotation = 0, rightWingRotation = 0, style }) {
  const s = size / 56;
  const leftRot = typeof leftWingRotation === 'number'
    ? `${leftWingRotation}deg`
    : leftWingRotation.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const rightRot = typeof rightWingRotation === 'number'
    ? `${rightWingRotation}deg`
    : rightWingRotation.interpolate({ inputRange: [-1, 1], outputRange: ['18deg', '-18deg'] });

  const LeftWing = typeof leftWingRotation === 'number' ? View : Animated.View;
  const RightWing = typeof rightWingRotation === 'number' ? View : Animated.View;

  return (
    <View style={[styles.root, { width: size * 1.4, height: size }, style]}>
      <View style={[styles.body, { width: 28 * s, height: 36 * s, borderRadius: 14 * s }]} />
      <View style={[styles.head, { width: 20 * s, height: 20 * s, borderRadius: 10 * s, top: -4 * s, right: 4 * s }]} />
      <View style={[styles.beak, { width: 8 * s, height: 6 * s, top: 8 * s, right: -2 * s }]} />
      <LeftWing
        style={[
          styles.wing,
          styles.wingLeft,
          { width: 22 * s, height: 14 * s, top: 10 * s, left: -4 * s, transform: [{ rotate: leftRot }] },
        ]}
      />
      <RightWing
        style={[
          styles.wing,
          styles.wingRight,
          { width: 22 * s, height: 14 * s, top: 10 * s, right: -4 * s, transform: [{ rotate: rightRot }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    position: 'absolute',
    backgroundColor: DOVE_WHITE,
    shadowColor: DOVE_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  head: {
    position: 'absolute',
    backgroundColor: DOVE_WHITE,
    shadowColor: DOVE_SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  beak: {
    position: 'absolute',
    backgroundColor: colors.textMuted,
    opacity: 0.7,
    borderRadius: 2,
    transform: [{ rotate: '-25deg' }],
  },
  wing: {
    position: 'absolute',
    backgroundColor: DOVE_WHITE,
    borderWidth: 0,
    borderRadius: 50,
    shadowColor: DOVE_SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
  wingLeft: {
    borderTopLeftRadius: 0,
    transformOrigin: 'right center',
  },
  wingRight: {
    borderTopRightRadius: 0,
    transformOrigin: 'left center',
  },
});
