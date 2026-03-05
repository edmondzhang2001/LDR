import { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const SWIPE_THRESHOLD = 120;
const FLY_OFF_DISTANCE = 400;
const STACK_OFFSET_Y = 6;
const STACK_OFFSET_X = 4;
const STACK_ROTATIONS = [-4, 3, -2, 1, 2, -3, 1, -2];

function getStackRotation(index) {
  return STACK_ROTATIONS[index % STACK_ROTATIONS.length];
}

/**
 * Interactive stack of partner photos as postcards. Newest on top. Swipe top card away to reveal the next.
 * When the last card is swiped, the stack resets so you can swipe through again.
 */
export function PostcardStack({ partnerPhotos = [] }) {
  const photos = useMemo(
    () =>
      (partnerPhotos ?? [])
        .filter((p) => p?.url)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [partnerPhotos]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const photosLengthRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }), // must match pan usage in transform
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          const toX = dx > 0 ? FLY_OFF_DISTANCE : -FLY_OFF_DISTANCE;
          Animated.timing(pan, {
            toValue: { x: toX, y: dy * 1.5 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            const len = photosLengthRef.current;
            setActiveIndex((prev) => (prev + 1 >= len ? 0 : prev + 1));
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 8,
            tension: 80,
          }).start();
        }
      },
    })
  ).current;

  const n = photos.length;
  photosLengthRef.current = n;
  const remaining = n - activeIndex;
  const visibleSlice = photos.slice(activeIndex);

  const rotateInterpolate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (n === 0) {
    return (
      <View style={styles.stackContainer}>
        <View style={styles.postcard}>
          <View style={styles.placeholderInner}>
            <Ionicons name="image-outline" size={48} color={colors.blushDark} />
            <Text style={styles.placeholderTitle}>Daily Story</Text>
            <Text style={styles.placeholderSubtitle}>Photos from your partner appear here</Text>
            <Text style={styles.placeholderHint}>Swipe through when they add some</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stackContainer}>
      {visibleSlice.map((photo, sliceIndex) => {
        const isTop = sliceIndex === 0;
        const globalIndex = activeIndex + sliceIndex;
        const stackRotation = getStackRotation(globalIndex);
        const stackOffsetY = sliceIndex * STACK_OFFSET_Y;
        const stackOffsetX = sliceIndex * STACK_OFFSET_X;

        const cardStyle = [
          styles.postcard,
          {
            zIndex: remaining - sliceIndex,
            transform: [
              { translateX: stackOffsetX },
              { translateY: stackOffsetY },
              { scale: isTop ? 1 : 0.95 },
              { rotate: isTop ? '0deg' : `${stackRotation}deg` },
            ],
          },
        ];

        if (isTop) {
          return (
            <Animated.View
              key={photo.url + globalIndex}
              style={[
                styles.postcard,
                {
                  zIndex: remaining,
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { rotate: rotateInterpolate },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.postcardInner}>
                <Image
                  source={{ uri: photo.url }}
                  style={styles.postcardImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>
          );
        }

        return (
          <View key={photo.url + globalIndex} style={cardStyle}>
            <View style={styles.postcardInner}>
              <Image
                source={{ uri: photo.url }}
                style={styles.postcardImage}
                resizeMode="cover"
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stackContainer: {
    width: '88%',
    alignSelf: 'center',
    aspectRatio: 4 / 3,
    marginBottom: 28,
    position: 'relative',
  },
  postcard: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    padding: 12,
    paddingBottom: 40,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  postcardInner: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  postcardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
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
