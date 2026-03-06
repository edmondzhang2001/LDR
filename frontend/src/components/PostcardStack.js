import { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const SWIPE_THRESHOLD = 120;
const FLY_OFF_DISTANCE = 400;
const STAMP_COLOR = '#6B5B52';
const FRAME_RADIUS = 24;
const INNER_RADIUS = 12;
const FRAME_PADDING = 12;
const FRAME_CHIN = 40;

const PINK_STRIPE = '#F5D0D0';
const CREAM_STRIPE = '#FFFBF5';

function getPresetIndexForCard(globalIndex) {
  return globalIndex % 4;
}

/** Candy Stripes: solid cream bg + diagonal pink stripes via rotated View rectangles. */
function CandyStripesFrame({ style, children }) {
  const stripeCount = 14;
  const stripeWidth = 16;
  const stripeSpacing = 28;
  const stripeHeight = 500;
  return (
    <View style={[styles.frameRoot, styles.frameOpaque, styles.candyStripesRootBg, style]}>
      <View style={styles.candyStripesOverlay} pointerEvents="none">
        {Array.from({ length: stripeCount }, (_, i) => (
          <View
            key={i}
            style={[
              styles.candyStripe,
              {
                left: -stripeHeight / 2 + i * stripeSpacing,
                top: -stripeHeight / 2,
                width: stripeWidth,
                height: stripeHeight,
                backgroundColor: PINK_STRIPE,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.frameChin}>{children}</View>
    </View>
  );
}

function HeartFrame({ style, children }) {
  const heartPositions = [
    { top: 8, left: 10 },
    { top: 8, right: 10 },
    { bottom: FRAME_CHIN + 8, left: 10 },
    { bottom: FRAME_CHIN + 8, right: 10 },
    { bottom: 10, right: 16 },
  ];
  return (
    <View style={[styles.frameRoot, styles.frameOpaque, styles.heartFrameBg, style]}>
      {heartPositions.map((pos, i) => (
        <View key={i} style={[styles.frameHeart, pos]} pointerEvents="none">
          <Ionicons name="heart" size={i === 4 ? 12 : 14} color={i === 4 ? colors.blushDark : '#E8A0A6'} />
        </View>
      ))}
      <View style={styles.frameChin}>{children}</View>
    </View>
  );
}

/** Gradient Aura: solid vibrant color + strong glow shadow (no gradient). */
function GradientAuraFrame({ style, children }) {
  return (
    <View style={[styles.frameRoot, styles.frameOpaque, styles.gradientAuraRootBg, styles.gradientAuraShadow, style]}>
      <View style={styles.frameChin}>{children}</View>
    </View>
  );
}

function PolkaDotsFrame({ style, children }) {
  const rows = 8;
  const cols = 6;
  const dotSize = 6;
  const spacing = 18;
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({ key: `${r}-${c}`, left: FRAME_PADDING + c * spacing, top: FRAME_PADDING + r * spacing });
    }
  }
  return (
    <View style={[styles.frameRoot, styles.frameOpaque, styles.polkaDotsBg, style]}>
      <View style={styles.polkaGrid} pointerEvents="none">
        {dots.map((d) => (
          <View
            key={d.key}
            style={[styles.polkaDot, { left: d.left, top: d.top, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]}
          />
        ))}
      </View>
      <View style={styles.frameChin}>{children}</View>
    </View>
  );
}

const FRAME_COMPONENTS = [CandyStripesFrame, HeartFrame, GradientAuraFrame, PolkaDotsFrame];

function seeded(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function useStackLayout(maxDepth) {
  return useMemo(
    () =>
      Array.from({ length: Math.max(0, maxDepth) }, (_, i) => ({
        rotation: -4 + seeded(i * 3) * 8,
        offsetX: (seeded(i * 7) - 0.5) * 16,
        offsetY: (seeded(i * 11) - 0.5) * 20,
        scale: Math.max(0.92, 1 - (i + 1) * 0.025),
      })),
    [maxDepth]
  );
}

function formatStampDate(createdAt) {
  if (!createdAt) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(createdAt));
}

export function PostcardStack({ partnerPhotos = [], partnerCity = '' }) {
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
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
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
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 8, tension: 80 }).start();
        }
      },
    })
  ).current;

  const n = photos.length;
  photosLengthRef.current = n;
  const remaining = n - activeIndex;
  const visibleSlice = photos.slice(activeIndex);
  const stackLayout = useStackLayout(Math.max(0, visibleSlice.length - 1));

  const rotateInterpolate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (n === 0) {
    const DefaultFrame = FRAME_COMPONENTS[0];
    return (
      <View style={styles.stackContainer}>
        <View style={styles.postcard}>
          <DefaultFrame>
            <View style={styles.placeholderInner}>
              <Ionicons name="image-outline" size={48} color={colors.blushDark} />
              <Text style={styles.placeholderTitle}>Daily Story</Text>
              <Text style={styles.placeholderSubtitle}>Photos from your partner appear here</Text>
              <Text style={styles.placeholderHint}>Swipe through when they add some</Text>
            </View>
          </DefaultFrame>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stackContainer}>
      {visibleSlice.map((photo, sliceIndex) => {
        const isTop = sliceIndex === 0;
        const globalIndex = activeIndex + sliceIndex;
        const layout = !isTop ? stackLayout[sliceIndex - 1] : null;
        const presetIndex = getPresetIndexForCard(globalIndex);
        const FrameComponent = FRAME_COMPONENTS[presetIndex];

        const stampText = [formatStampDate(photo.createdAt), partnerCity].filter(Boolean).join(' • ') || '—';
        const cardContent = (
          <>
            <View style={styles.postcardInner}>
              <Image source={{ uri: photo.url }} style={styles.postcardImage} resizeMode="cover" />
            </View>
            <Text style={styles.stamp} numberOfLines={1}>{stampText}</Text>
          </>
        );

        if (isTop) {
          const canSwipe = n > 1;
          if (canSwipe) {
            return (
              <Animated.View
                key={photo.url + globalIndex}
                style={[
                  styles.postcard,
                  {
                    zIndex: remaining,
                    transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotateInterpolate }],
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <FrameComponent>{cardContent}</FrameComponent>
              </Animated.View>
            );
          }
          return (
            <View key={photo.url + globalIndex} style={[styles.postcard, { zIndex: remaining }]}>
              <FrameComponent>{cardContent}</FrameComponent>
            </View>
          );
        }

        const { rotation, offsetX, offsetY, scale } = layout;
        return (
          <Animated.View
            key={photo.url + globalIndex}
            shouldRasterizeIOS={true}
            style={[
              styles.postcard,
              {
                zIndex: remaining - sliceIndex,
                transform: [
                  { translateX: offsetX },
                  { translateY: offsetY },
                  { scale },
                  { rotate: `${rotation}deg` },
                ],
              },
            ]}
          >
            <FrameComponent>
              <View style={styles.postcardInner}>
                <Image source={{ uri: photo.url }} style={styles.postcardImage} resizeMode="cover" />
              </View>
              <Text style={styles.stamp} numberOfLines={1}>{stampText}</Text>
            </FrameComponent>
          </Animated.View>
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
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    opacity: 1,
    backgroundColor: '#FFFFFF',
  },
  frameRoot: {
    flex: 1,
    borderRadius: FRAME_RADIUS,
    overflow: 'hidden',
    opacity: 1,
  },
  frameOpaque: {
    opacity: 1,
  },
  candyStripesRootBg: {
    backgroundColor: CREAM_STRIPE,
    overflow: 'hidden',
  },
  candyStripesOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  candyStripe: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
  frameChin: {
    flex: 1,
    padding: FRAME_PADDING,
    paddingBottom: FRAME_CHIN,
  },
  heartFrameBg: {
    backgroundColor: '#FEF0F0',
  },
  gradientAuraShadow: {
    shadowColor: '#E8A0B0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 36,
    elevation: 20,
  },
  gradientAuraRootBg: {
    backgroundColor: '#F8D4E0',
  },
  polkaDotsBg: {
    backgroundColor: '#FFFBF8',
  },
  polkaGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  polkaDot: {
    position: 'absolute',
    backgroundColor: '#E8B4B8',
  },
  frameHeart: {
    position: 'absolute',
  },
  postcardInner: {
    flex: 1,
    borderRadius: INNER_RADIUS,
    overflow: 'hidden',
  },
  postcardImage: {
    width: '100%',
    height: '100%',
    borderRadius: INNER_RADIUS,
  },
  stamp: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    fontSize: 12,
    color: STAMP_COLOR,
    opacity: 0.85,
    fontStyle: 'italic',
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
