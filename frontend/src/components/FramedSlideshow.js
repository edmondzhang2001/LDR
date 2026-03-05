import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const INTERVAL_MS = 4000;
const FADE_DURATION_MS = 800;

/**
 * Polaroid-style frame showing only the partner's photos (each user sees what their partner posted).
 * Cross-fade opacities for flicker-free loop.
 */
export function FramedSlideshow({ userPhotos = [], partnerPhotos = [] }) {
  const photos = (partnerPhotos ?? [])
    .filter((p) => p?.url)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const [currentIndex, setCurrentIndex] = useState(0);
  const opacityRefs = useRef([]);
  const n = photos.length;

  if (n > 0 && opacityRefs.current.length !== n) {
    opacityRefs.current = photos.map((_, i) => new Animated.Value(i === 0 ? 1 : 0));
  }
  const refs = opacityRefs.current;

  useEffect(() => {
    if (n <= 1) return;

    const id = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % n;
        const refs = opacityRefs.current;
        if (refs.length !== n) return prev;

        Animated.parallel(
          refs.map((opacity, i) =>
            Animated.timing(opacity, {
              toValue: i === nextIndex ? 1 : 0,
              duration: FADE_DURATION_MS,
              useNativeDriver: true,
            })
          )
        ).start();
        return nextIndex;
      });
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [n]);

  // No photos: show placeholder with "Add photo" prompt
  if (n === 0) {
    return (
      <View style={styles.frame}>
        <View style={styles.placeholderInner}>
          <Ionicons name="image-outline" size={48} color={colors.blushDark} />
          <Text style={styles.placeholderTitle}>Daily Story</Text>
          <Text style={styles.placeholderSubtitle}>Take a photo to start</Text>
          <Text style={styles.placeholderHint}>Tap camera to add</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.imageContainer}>
        {photos.map((photo, i) => (
          <Animated.Image
            key={photo.url + i}
            source={{ uri: photo.url }}
            style={[StyleSheet.absoluteFillObject, styles.image, { opacity: refs[i] ?? 0 }]}
            resizeMode="cover"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '90%',
    alignSelf: 'center',
    aspectRatio: 4 / 3,
    backgroundColor: '#FFF',
    borderWidth: 10,
    borderColor: '#FFF',
    borderRadius: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  placeholderHint: {
    fontSize: 13,
    color: colors.blushDark,
    fontWeight: '600',
  },
});
