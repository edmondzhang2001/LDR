import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RADIUS = 24;
const FAB_HEIGHT = 56;
const FAB_BOTTOM = 32;

/**
 * Frosted tray at the bottom for Immersive Mode. Lighter glass so pastel + dark text stay readable.
 * paddingBottom leaves room for the Camera FAB.
 */
export function BottomActionTray({ children }) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom, 16) + FAB_HEIGHT + 12;

  return (
    <View style={[styles.tray, { paddingBottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
});
