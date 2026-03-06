import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { FramedPostcardForOverlay } from './PostcardStack';
import { Dove } from './Dove';
import { colors } from '../theme/colors';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const POSTCARD_WIDTH = Math.min(WINDOW_WIDTH * 0.72, 320);
const POSTCARD_HEIGHT = POSTCARD_WIDTH * (3 / 4);
const DOVE_SIZE = 52;
/** Fly well beyond the screen so dove + postcard exit completely (top-right). */
const FLY_OFF_TARGET_X = WINDOW_WIDTH + 150;
const FLY_OFF_TARGET_Y = -WINDOW_HEIGHT - 150;
const WOBBLE_DEG = 8;

/**
 * Overlay shown when isAnimatingSend or isSendingPhoto.
 * Phase 1: Centered completed postcard (frozen frame).
 * Phase 2: Dove fades in, wings flap.
 * Phase 3: Dove "grabs" postcard, then dove+postcard fly off top-right with wobble.
 * Phase 4: On fly-off complete, onUploadRequest() is called; on success/fail, onDone() clears state.
 * On upload failure, optional "drop" animation then cleanup.
 */
export function DoveCarryOverlay({
  visible,
  imageUri,
  caption,
  stampText,
  onUploadRequest,
  onDone,
}) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const postcardOpacity = useRef(new Animated.Value(1)).current;
  const doveOpacity = useRef(new Animated.Value(0)).current;
  const doveX = useRef(new Animated.Value(0)).current;
  const doveY = useRef(new Animated.Value(0)).current;
  const wingPhase = useRef(new Animated.Value(0)).current;
  const flyX = useRef(new Animated.Value(0)).current;
  const flyY = useRef(new Animated.Value(0)).current;
  const flyRotate = useRef(new Animated.Value(0)).current;
  const dropY = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(1)).current;
  const wingLoopRef = useRef(null);
  /** Dummy value for no-op animation; never pass primitives or {} to Animated.timing. */
  const noopValue = useRef(new Animated.Value(0)).current;

  const stamp = stampText ?? (caption?.trim() ? `"${caption.trim()}"` : '');

  useEffect(() => {
    if (!visible || !imageUri) return;

    overlayOpacity.setValue(0);
    doveOpacity.setValue(0);
    doveX.setValue(POSTCARD_WIDTH / 2 + 24);
    doveY.setValue(28);
    flyX.setValue(0);
    flyY.setValue(0);
    flyRotate.setValue(0);
    dropY.setValue(0);
    dropOpacity.setValue(1);
    postcardOpacity.setValue(1);

    // Phase 1: Show overlay and postcard (useNativeDriver: false everywhere to avoid stopTracking mix)
    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();

    // Phase 2: Fade in dove after short delay, start wing flap
    const doveFadeIn = Animated.delay(400);
    const doveAppear = Animated.timing(doveOpacity, { toValue: 1, duration: 400, useNativeDriver: false });
    wingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(wingPhase, { toValue: 1, duration: 120, useNativeDriver: false }),
        Animated.timing(wingPhase, { toValue: -1, duration: 120, useNativeDriver: false }),
      ]),
      { iterations: -1 }
    );

    const phase2 = Animated.sequence([
      doveFadeIn,
      Animated.parallel([
        doveAppear,
        Animated.timing(noopValue, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    ]);

    phase2.start(() => wingLoopRef.current?.start());

    // Phase 3: After dove visible, move dove to "grab" (above postcard), then fly off
    const grabDuration = 400;
    const flyDuration = 1100; // smooth 800–1200 ms for full fly-off
    const grabStart = 900; // ms from overlay show

    const moveDoveToGrab = Animated.delay(grabStart);
    const doveGrabX = 0;
    const doveGrabY = -DOVE_SIZE * 0.5;
    const grabAnim = Animated.parallel([
      Animated.timing(doveX, { toValue: doveGrabX, duration: grabDuration, useNativeDriver: false }),
      Animated.timing(doveY, { toValue: doveGrabY, duration: grabDuration, useNativeDriver: false }),
    ]);

    const wobble = Animated.sequence([
      Animated.timing(flyRotate, { toValue: WOBBLE_DEG, duration: 200, useNativeDriver: false }),
      Animated.timing(flyRotate, { toValue: -WOBBLE_DEG, duration: 400, useNativeDriver: false }),
      Animated.timing(flyRotate, { toValue: WOBBLE_DEG / 2, duration: 400, useNativeDriver: false }),
      Animated.timing(flyRotate, { toValue: -WOBBLE_DEG / 2, duration: 400, useNativeDriver: false }),
    ]);
    const flyAnim = Animated.parallel([
      Animated.timing(flyX, { toValue: FLY_OFF_TARGET_X, duration: flyDuration, useNativeDriver: false }),
      Animated.timing(flyY, { toValue: FLY_OFF_TARGET_Y, duration: flyDuration, useNativeDriver: false }),
      Animated.loop(wobble, { iterations: 2 }),
    ]);

    const phase3 = Animated.sequence([
      moveDoveToGrab,
      grabAnim,
      Animated.delay(150),
      flyAnim,
    ]);

    phase3.start(() => {
      wingLoopRef.current?.stop();
      runUpload();
    });

    function runUpload() {
      onUploadRequest()
        .then((success) => {
          if (success) {
            cleanup();
          } else {
            playDropThenCleanup();
          }
        })
        .catch(() => playDropThenCleanup());
    }

    function playDropThenCleanup() {
      Animated.parallel([
        Animated.timing(dropY, { toValue: 120, duration: 500, useNativeDriver: false }),
        Animated.timing(dropOpacity, { toValue: 0.4, duration: 500, useNativeDriver: false }),
      ]).start(() => cleanup());
    }

    function cleanup() {
      overlayOpacity.setValue(0);
      onDone();
    }

    return () => {
      wingLoopRef.current?.stop();
    };
  }, [visible, imageUri]);

  if (!visible) return null;

  const wingRot = wingPhase.interpolate({ inputRange: [-1, 1], outputRange: [-18, 18] });
  const flyRotateStr = flyRotate.interpolate({
    inputRange: [-WOBBLE_DEG, WOBBLE_DEG],
    outputRange: [`${-WOBBLE_DEG}deg`, `${WOBBLE_DEG}deg`],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.centered,
          {
            transform: [
              { translateX: flyX },
              { translateY: Animated.add(flyY, dropY) },
              { rotate: flyRotateStr },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.postcardWrap, { opacity: Animated.multiply(postcardOpacity, dropOpacity) }]}>
          <FramedPostcardForOverlay
            imageUri={imageUri}
            stampText={stamp}
            framePresetIndex={2}
            style={[styles.postcardBox, { width: POSTCARD_WIDTH, height: POSTCARD_HEIGHT }]}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.doveWrap,
            {
              opacity: doveOpacity,
              transform: [
                { translateX: doveX },
                { translateY: doveY },
              ],
            },
          ]}
        >
          <Dove size={DOVE_SIZE} leftWingRotation={wingRot} rightWingRotation={wingPhase} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  centered: {
    position: 'absolute',
    left: (WINDOW_WIDTH - (POSTCARD_WIDTH + 120)) / 2,
    top: (WINDOW_HEIGHT - (POSTCARD_HEIGHT + 100)) / 2,
    width: POSTCARD_WIDTH + 120,
    height: POSTCARD_HEIGHT + 100,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  postcardWrap: {
    position: 'absolute',
    left: 60,
    top: 50,
  },
  postcardBox: {
    position: 'relative',
  },
  doveWrap: {
    position: 'absolute',
    left: 60 + POSTCARD_WIDTH / 2 - (DOVE_SIZE * 1.4) / 2,
    top: 0,
  },
});
