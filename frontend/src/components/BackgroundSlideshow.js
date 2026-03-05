import { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const CROSSFADE_DURATION_MS = 2000;

/**
 * Two-layer crossfade: exactly two images, Layer A (bottom) and Layer B (top).
 * B fades from 0 to 1; on complete, index advances, B opacity resets to 0, repeat.
 * Seamless loop including last → first.
 */
export function BackgroundSlideshow({ userPhotos = [], partnerPhotos = [] }) {
  const photos = [...userPhotos, ...partnerPhotos]
    .filter((p) => p?.url)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const [currentIndex, setCurrentIndex] = useState(0);
  const opacityB = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const n = photos.length;

  useEffect(() => {
    if (n <= 1) return;

    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;
      animRef.current = Animated.timing(opacityB, {
        toValue: 1,
        duration: CROSSFADE_DURATION_MS,
        useNativeDriver: true,
      });
      animRef.current.start(() => {
        if (cancelled) return;
        setCurrentIndex((i) => (i + 1) % n);
        opacityB.setValue(0);
        requestAnimationFrame(runCycle);
      });
    };

    runCycle();

    return () => {
      cancelled = true;
      if (animRef.current != null) animRef.current.stop();
    };
  }, [n, opacityB]);

  if (photos.length === 0) return null;

  const indexA = currentIndex;
  const indexB = (currentIndex + 1) % n;
  const photoA = photos[indexA];
  const photoB = photos[indexB];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.Image
        source={{ uri: photoA.url }}
        style={[StyleSheet.absoluteFillObject, styles.image]}
        resizeMode="cover"
      />
      <Animated.Image
        source={{ uri: photoB.url }}
        style={[StyleSheet.absoluteFillObject, styles.image, { opacity: opacityB }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
