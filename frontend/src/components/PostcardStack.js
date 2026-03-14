import { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const SWIPE_THRESHOLD = 120;
const TAP_MAX_MOVEMENT = 20;
const FLY_OFF_DISTANCE = 400;
const STAMP_COLOR = '#6B5B52';
const FRAME_RADIUS = 24;
const INNER_RADIUS = 12;
const FRAME_PADDING = 12;
const FRAME_CHIN = 40;

const PINK_STRIPE = '#F5D0D0';
const CREAM_STRIPE = '#FFFBF5';
/** Max cards to mount at once (each loads a full-res image). Prevents iOS memory kill. */
const MAX_RENDERED_CARDS = 10;

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

function getStackLayout(maxDepth) {
  return Array.from({ length: Math.max(0, maxDepth) }, (_, i) => ({
    rotation: -4 + seeded(i * 3) * 8,
    offsetX: (seeded(i * 7) - 0.5) * 16,
    offsetY: (seeded(i * 11) - 0.5) * 20,
    scale: Math.max(0.92, 1 - (i + 1) * 0.025),
  }));
}

function useStackLayout(maxDepth) {
  return useMemo(() => getStackLayout(maxDepth), [maxDepth]);
}

function formatStampDate(createdAt) {
  if (!createdAt) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(createdAt));
}

export function PostcardStack({ partnerPhotos = [], partnerCity = '', partnerFirstName = '' }) {
  const photos = useMemo(
    () =>
      (partnerPhotos ?? [])
        .filter((p) => p?.url)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [partnerPhotos]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [dropIndex, setDropIndex] = useState(-1);
  const pan = useRef(new Animated.ValueXY()).current;
  const photosLengthRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const dropValuesRef = useRef(null);
  const dropRotationsRef = useRef(null);

  const triggerOneAtATimeReset = () => {
    setIsResetting(true);
    setActiveIndex(0);
  };

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
          }).start(({ finished }) => {
            if (!finished) return;
            const len = photosLengthRef.current;
            const currentIndex = activeIndexRef.current;
            const wasLastCard = currentIndex === len - 1;
            if (wasLastCard) {
              triggerOneAtATimeReset();
            } else {
              setActiveIndex((prev) => prev + 1);
            }
            setTimeout(() => pan.setValue({ x: 0, y: 0 }), 15);
          });
        } else if (
          Math.abs(dx) < TAP_MAX_MOVEMENT &&
          Math.abs(dy) < TAP_MAX_MOVEMENT &&
          photosLengthRef.current > 1
        ) {
          Animated.timing(pan, {
            toValue: { x: FLY_OFF_DISTANCE, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (!finished) return;
            const len = photosLengthRef.current;
            const currentIndex = activeIndexRef.current;
            const wasLastCard = currentIndex === len - 1;
            if (wasLastCard) {
              triggerOneAtATimeReset();
            } else {
              setActiveIndex((prev) => prev + 1);
            }
            setTimeout(() => pan.setValue({ x: 0, y: 0 }), 15);
          });
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 8, tension: 80 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const n = photos.length;

  // Cascade drop: when reset just happened (activeIndex 0, isResetting), animate each card down one-by-one
  useEffect(() => {
    if (!isResetting || activeIndex !== 0 || n < 2) return;
    const layout = getStackLayout(n - 1);
    dropValuesRef.current = Array.from({ length: n }, () => new Animated.ValueXY({ x: 0, y: -380 }));
    dropRotationsRef.current = Array.from({ length: n }, () => new Animated.Value(90));
    setDropIndex(0);

    const CASCADE_DELAY = 220;
    const timeouts = [];

    const runDrop = (i) => {
      const toX = i === 0 ? 0 : layout[i - 1].offsetX;
      const toY = i === 0 ? 0 : layout[i - 1].offsetY;
      const toRotation = i === 0 ? 0 : layout[i - 1].rotation;
      const valXY = dropValuesRef.current[i];
      const valRot = dropRotationsRef.current[i];
      setDropIndex(i);
      Animated.parallel([
        Animated.spring(valXY, {
          toValue: { x: toX, y: toY },
          friction: 12,
          tension: 80,
          useNativeDriver: false,
        }),
        Animated.spring(valRot, {
          toValue: toRotation,
          friction: 10,
          tension: 60,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (i === n - 1) {
          setDropIndex(-1);
          setIsResetting(false);
          dropValuesRef.current = null;
          dropRotationsRef.current = null;
        }
      });
    };

    // Start first card immediately so there's no pause after last card flies off
    runDrop(0);

    // Drop remaining cards with stagger
    for (let i = 1; i < n; i++) {
      timeouts.push(setTimeout(() => runDrop(i), i * CASCADE_DELAY));
    }

    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [isResetting, activeIndex, n]);

  photosLengthRef.current = n;
  const remaining = n - activeIndex;
  const visibleSlice = photos.slice(activeIndex);
  const renderedSlice = visibleSlice.slice(0, MAX_RENDERED_CARDS);
  const stackLayout = useStackLayout(Math.max(0, renderedSlice.length - 1));

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

  const isDropMode = isResetting && dropValuesRef.current && dropValuesRef.current.length === visibleSlice.length;

  return (
    <View style={styles.stackContainer}>
      {renderedSlice.map((photo, sliceIndex) => {
        const isTop = sliceIndex === 0;
        const globalIndex = activeIndex + sliceIndex;
        const layout = !isTop ? stackLayout[sliceIndex - 1] : null;
        const presetIndex = getPresetIndexForCard(globalIndex);
        const FrameComponent = FRAME_COMPONENTS[presetIndex];

        const stampText =
          photo.caption && photo.caption.trim()
            ? `"${photo.caption.trim()}" - ${partnerFirstName || 'Partner'}`
            : [formatStampDate(photo.createdAt), partnerCity].filter(Boolean).join(' • ') || '—';
        const cardContent = (
          <>
            <View style={styles.postcardInner}>
              <Image source={{ uri: photo.url }} style={styles.postcardImage} resizeMode="cover" />
            </View>
            <Text style={styles.stamp} numberOfLines={2}>{stampText}</Text>
          </>
        );

        if (isDropMode) {
          const dropVal = dropValuesRef.current[sliceIndex];
          const dropRot = dropRotationsRef.current[sliceIndex];
          const dropRotateStr = dropRot.interpolate({
            inputRange: [-15, 90],
            outputRange: ['-15deg', '90deg'],
          });
          const dropLayout = sliceIndex === 0 ? null : stackLayout[sliceIndex - 1];
          const dropScale = dropLayout ? dropLayout.scale : 1;
          return (
            <Animated.View
              key={photo.url + globalIndex}
              style={[
                styles.postcard,
                {
                  zIndex: sliceIndex,
                  transform: [...dropVal.getTranslateTransform(), { rotate: dropRotateStr }, { scale: dropScale }],
                },
              ]}
            >
              <FrameComponent>{cardContent}</FrameComponent>
            </Animated.View>
          );
        }

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
                {...(canSwipe && !isResetting ? panResponder.panHandlers : {})}
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
              <Text style={styles.stamp} numberOfLines={2}>{stampText}</Text>
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
    fontSize: 11,
    color: STAMP_COLOR,
    opacity: 0.9,
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

/** Single framed postcard for overlay (e.g. dove send animation). framePresetIndex 0–3 = CandyStripes, Heart, GradientAura, PolkaDots. */
export function FramedPostcardForOverlay({ imageUri, stampText, framePresetIndex = 2, style }) {
  const FrameComponent = FRAME_COMPONENTS[framePresetIndex % 4];
  return (
    <View style={[styles.postcard, style]}>
      <FrameComponent>
        <View style={styles.postcardInner}>
          <Image source={{ uri: imageUri }} style={styles.postcardImage} resizeMode="cover" />
        </View>
        {stampText ? <Text style={styles.stamp} numberOfLines={2}>{stampText}</Text> : null}
      </FrameComponent>
    </View>
  );
}
