import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Soft pastel path color (blush, low opacity) */
const PATH_STROKE = `${colors.blush}99`;
const PATH_STROKE_WIDTH = 2;
const DOT_SPACING = 10;
const ELEMENT_SIZE = 20;

/**
 * Minimalist LDR background: dotted "flight path" and a small element (heart)
 * that moves along the path as the user progresses through onboarding.
 * Progress: 0 = start, 1 = destination (distance closing).
 */
export function LDRBackground({ totalSlides, currentSlideIndex, hideMovingElement }) {
  const progress = useSharedValue(totalSlides > 1 ? currentSlideIndex / (totalSlides - 1) : 0);

  useEffect(() => {
    const toValue = totalSlides > 1 ? currentSlideIndex / (totalSlides - 1) : 0;
    progress.value = withTiming(toValue, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentSlideIndex, totalSlides, progress]);

  // Path: gentle curve from bottom-left to top-right (distance closing metaphor)
  const pathD = [
    `M ${0.05 * SCREEN_WIDTH} ${0.82 * SCREEN_HEIGHT}`,
    `C ${0.35 * SCREEN_WIDTH} ${0.6 * SCREEN_HEIGHT}, ${0.65 * SCREEN_WIDTH} ${0.35 * SCREEN_HEIGHT}, ${0.95 * SCREEN_WIDTH} ${0.18 * SCREEN_HEIGHT}`,
  ].join(' ');

  // Approximate position along path (quadratic curve)
  // t from 0 to 1 -> x and y along the curve
  const getPosition = (t) => {
    'worklet';
    const x = 0.05 * SCREEN_WIDTH + t * (0.9 * SCREEN_WIDTH);
    const y = 0.82 * SCREEN_HEIGHT - t * (0.64 * SCREEN_HEIGHT) + Math.sin(t * Math.PI) * (0.08 * SCREEN_HEIGHT);
    return { x, y };
  };

  const animatedStyle = useAnimatedStyle(() => {
    const { x, y } = getPosition(progress.value);
    return {
      position: 'absolute',
      left: x - ELEMENT_SIZE / 2,
      top: y - ELEMENT_SIZE / 2,
      width: ELEMENT_SIZE,
      height: ELEMENT_SIZE,
      opacity: 0.85,
    };
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
        <Path
          d={pathD}
          fill="none"
          stroke={PATH_STROKE}
          strokeWidth={PATH_STROKE_WIDTH}
          strokeDasharray={`${DOT_SPACING} ${DOT_SPACING * 1.2}`}
          strokeLinecap="round"
        />
      </Svg>
      {!hideMovingElement && (
        <Animated.View style={[styles.movingElement, animatedStyle]}>
          <Svg width={ELEMENT_SIZE} height={ELEMENT_SIZE} viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={colors.blushDark}
              opacity={0.9}
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
  },
  movingElement: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
