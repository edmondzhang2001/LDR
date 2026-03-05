import { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';

const CROSSFADE_DURATION = 1500;
const HOLD_DURATION = 5000;

/**
 * Combines user + partner photos (last 24h), sorted by createdAt, and loops a slow cross-fade.
 */
export function BackgroundSlideshow({ userPhotos = [], partnerPhotos = [] }) {
  const allPhotos = [...userPhotos, ...partnerPhotos]
    .filter((p) => p?.url)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (allPhotos.length === 0) return;
    const next = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: CROSSFADE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        setIndex((i) => (i + 1) % allPhotos.length);
        opacity.setValue(0);
        Animated.timing(opacity, {
          toValue: 1,
          duration: CROSSFADE_DURATION,
          useNativeDriver: true,
        }).start();
      });
    };
    const id = setInterval(next, HOLD_DURATION + CROSSFADE_DURATION);
    return () => clearInterval(id);
  }, [allPhotos.length, opacity]);

  if (allPhotos.length === 0) return null;

  const current = allPhotos[index];
  const nextIndex = (index + 1) % allPhotos.length;
  const nextPhoto = allPhotos[nextIndex];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {nextPhoto && (
        <Image
          source={{ uri: nextPhoto.url }}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          resizeMode="cover"
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <Image
          source={{ uri: current.url }}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
