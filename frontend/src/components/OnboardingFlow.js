import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
  Easing as RNEasing,
  Keyboard,
  Platform,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, glassTextShadow } from '../theme/colors';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { LDRBackground } from './LDRBackground';
import { Dove } from './Dove';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_HEIGHT = SCREEN_HEIGHT;
const RADIUS = 28;
const SHADOW = {
  shadowColor: colors.shadowStrong,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 4,
};

const STOCK_IMAGES = [
  require('../../assets/stock-pics/coffee.png'),
  require('../../assets/stock-pics/selfie.png'),
  require('../../assets/stock-pics/party.png'),
  require('../../assets/stock-pics/brunch.png'),
  require('../../assets/stock-pics/gym.png'),
  require('../../assets/stock-pics/car.png'),
  require('../../assets/stock-pics/shopping.png'),
];
// Widget-sized coffee image (~124×96) so it doesn't need much resizing
const WIDGET_COFFEE_IMAGE = require('../../assets/stock-pics/coffee_small.jpg');
const POSTCARD_PASTELS = [
  '#F5D0D0', // pastel pink
  '#B8E3D4', // mint
  '#D4C5F9', // lavender
  '#FFFBF5', // cream
  '#FFF9C4', // pale yellow
  '#B8D4E3', // soft blue
  '#FFDAB9', // peach (hero)
];
const CARD_IMAGE_SIZE = 120;
const HERO_IMAGE_SIZE = 160;
const CARD_PADDING = 10;
const CARD_CHIN = 28;
const CARD_WRAPPER_W = CARD_IMAGE_SIZE + CARD_PADDING * 2;
const CARD_WRAPPER_H = CARD_IMAGE_SIZE + CARD_PADDING + CARD_CHIN;
const HERO_WRAPPER_W = HERO_IMAGE_SIZE + CARD_PADDING * 2;
const HERO_WRAPPER_H = HERO_IMAGE_SIZE + CARD_PADDING + CARD_CHIN;
// [top, left?, right?, rotateDeg, zIndex, isHero]
const COLLAGE_LAYOUT = [
  [0, 0, null, -15, 1, false],
  [15, null, 5, 12, 2, false],
  [100, -15, null, -8, 3, false],
  [110, null, -10, 18, 4, false],
  [248, 15, null, -12, 5, false],  // orange/bottom-left: moved down from the rest
  [198, null, 28, 14, 6, false],   // white/bottom-right: right so less overlap with hero
  [290, null, null, -20, 10, true], // hero (lavender)
];

const QUESTION_1 = {
  heading: "What's your current situation?",
  options: ['Long distance', 'Different timezones', 'Closing the gap soon', 'Just spending some time apart'],
};
const QUESTION_2 = {
  heading: "What's the hardest part of being apart?",
  options: ['Missing the little moments', 'Timezone math', 'Keeping the spark alive', 'Not knowing their schedule'],
};
const QUESTION_3 = {
  heading: "What brings you here today?",
  options: ['Feeling closer to my partner', 'Sending fun surprises', 'Having a shared space', 'Just exploring'],
};
const QUESTION_4 = {
  heading: 'How do you want to share moments?',
  options: ['Quick selfies', 'Daily life snapshots', 'Special occasion photos', 'A mix of everything'],
};
const QUESTION_5 = {
  heading: "What check-in rhythm feels right?",
  options: ['A few times a day', 'Once a day', 'Every couple of days', 'Whenever life allows'],
};

const FEATURE_TITLES = [
  'SNAP, SEND, SMILE.',
  'YOUR FIRST IMPRESSIONS.',
  'BRIDGE THE DISTANCE.',
  'OUR MAGIC.',
  'ONE SUBSCRIPTION. BOTH OF YOU.',
  'COUNT DOWN ON YOUR HOME SCREEN.',
];
const TOTAL_SLIDES = 14;
const PHOTO_DELIVERY_SLIDE_INDEX = 3;
const WIDGET_DROP_SLIDE_INDEX = 4;
const CALENDAR_SLIDE_INDEX = 5;
const PARTNER_NAME_SLIDE_INDEX = 1;
const SCIENCE_SLIDE_INDEX = 6;
const FEATURE_SLIDE_INDICES = [2, CALENDAR_SLIDE_INDEX, 10, 12];
const FINAL_SLIDE_INDEX = TOTAL_SLIDES - 1;
const WIDGET_DROP_ANIMATION_DURATION_MS = 4200;
const SCIENCE_ANIMATION = {
  titleDelay: 0,
  sentence1Delay: 2200,
  sentence2Delay: 5200,
  graphRevealDelay: 8500,
  graphFillDelay: 9500,
  stayBarDuration: 3600,
  insightRevealDelay: 11200,
  buttonDelay: 15500,
};

const SEGMENT_FILL_DURATION = 280;
const DELIVERY_DOVE_SIZE = 74;
const DELIVERY_WOBBLE_DEG = 5;

/** Subtle scale pulse for the calendar widget countdown number. */
function CalendarCountdownPulse({ children }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(scale);
  }, [scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedReanimated.View style={[styles.calendarWidgetNumberWrap, animatedStyle]}>
      {children}
    </AnimatedReanimated.View>
  );
}

function ConfettiBurst({ visible, onDone }) {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!visible) return undefined;
    setBurstKey((k) => k + 1);
    const t = setTimeout(() => onDone?.(), 1850);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  if (!visible) return null;

  // Re-keying forces particles to re-mount and re-run animations.
  return (
    <View key={burstKey} pointerEvents="none" style={styles.confettiOverlay}>
      {Array.from({ length: 18 }, (_, i) => (
        <ConfettiParticle key={`L-${burstKey}-${i}`} side="left" index={i} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <ConfettiParticle key={`R-${burstKey}-${i}`} side="right" index={i} />
      ))}
    </View>
  );
}

function ConfettiParticle({ side, index }) {
  const t = useSharedValue(0);

  // Deterministic-ish randomness per mount.
  const seed = (index + 1) * (side === 'left' ? 13 : 29);
  const rand = (n) => {
    const x = Math.sin(seed * 999 + n * 97) * 10000;
    return x - Math.floor(x);
  };

  const size = 6 + Math.round(rand(1) * 6);
  const startY = 40 + rand(2) * (SCREEN_HEIGHT * 0.55);
  const endY = startY + 140 + rand(3) * 200;
  const startX = side === 'left' ? -20 - rand(4) * 40 : SCREEN_WIDTH + 20 + rand(4) * 40;
  const endXBase = SCREEN_WIDTH * (0.28 + rand(5) * 0.28);
  const endX = side === 'left' ? endXBase : SCREEN_WIDTH - endXBase;
  const rotateBase = -25 + rand(6) * 50;
  const spin = (rand(7) > 0.5 ? 1 : -1) * (160 + rand(8) * 220);
  const delay = Math.round(rand(9) * 320);
  const duration = 1200 + Math.round(rand(10) * 480);
  const colorsPool = [colors.blushDark, colors.skyDark, colors.blush, '#F7C59F', '#B8E3D4', '#D4C5F9'];
  const color = colorsPool[Math.floor(rand(11) * colorsPool.length)];

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    }, () => {
      // noop
    });
    // Apply delay by starting from 0 and jumping after delay (keeps everything on UI thread).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = t.value;
    const x = startX + (endX - startX) * p;
    const y = startY + (endY - startY) * p;
    const r = rotateBase + spin * p;
    const opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    const scale = 0.85 + 0.25 * Math.sin(p * Math.PI);
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${r}deg` }, { scale }],
    };
  });

  // Manual delay using JS timeout (keeps component tiny; only runs at burst time).
  useEffect(() => {
    const to = setTimeout(() => {
      t.value = 0;
      t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    }, delay);
    return () => clearTimeout(to);
  }, [delay, duration, t]);

  return (
    <AnimatedReanimated.View
      style={[
        styles.confettiPiece,
        { width: size, height: size * (1.6 + rand(12) * 0.9), backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

/** Premium segmented progress bar: smooth left-to-right fill per segment (Reanimated). */
function SegmentedProgressBar({ segments, activeIndex }) {
  const segmentFill = useSharedValue(0);
  const activeIndexRef = useSharedValue(0);
  const prevIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (activeIndex > prevIndexRef.current) {
      segmentFill.value = 0;
      segmentFill.value = withTiming(1, {
        duration: SEGMENT_FILL_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else if (activeIndex < prevIndexRef.current) {
      segmentFill.value = 1;
    } else if (activeIndex === 0 && prevIndexRef.current === 0) {
      segmentFill.value = withTiming(1, {
        duration: SEGMENT_FILL_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }
    prevIndexRef.current = activeIndex;
    activeIndexRef.value = activeIndex;
  }, [activeIndex, segmentFill, activeIndexRef]);

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: segments }, (_, i) => (
        <SegmentFill
          key={i}
          index={i}
          segmentFill={segmentFill}
          activeIndexRef={activeIndexRef}
        />
      ))}
    </View>
  );
}

function SegmentFill({ index, segmentFill, activeIndexRef }) {
  const animatedStyle = useAnimatedStyle(() => {
    const active = activeIndexRef.value;
    let scaleX = 0;
    if (index < active) scaleX = 1;
    else if (index === active) scaleX = segmentFill.value;
    return {
      transformOrigin: 'left',
      transform: [{ scaleX }],
    };
  });
  return (
    <View style={[styles.progressSegment, styles.progressSegmentEmpty]}>
      <AnimatedReanimated.View
        style={[styles.progressSegmentFill, animatedStyle]}
      />
    </View>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState('intro');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPartnerNameSubmitting, setIsPartnerNameSubmitting] = useState(false);
  const [submittedPartnerName, setSubmittedPartnerName] = useState('');
  const [scienceButtonEnabled, setScienceButtonEnabled] = useState(false);
  const [scienceInsightVisible, setScienceInsightVisible] = useState(false);
  const [stayPctDisplay, setStayPctDisplay] = useState(0);
  const [widgetDropButtonEnabled, setWidgetDropButtonEnabled] = useState(false);
  const [calendarCountdownDisplay, setCalendarCountdownDisplay] = useState(15);
  const [calendarConfettiVisible, setCalendarConfettiVisible] = useState(false);
  const [calendarButtonEnabled, setCalendarButtonEnabled] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const deliveryAnim = useRef(new Animated.Value(0)).current;
  const deliveryDoveOpacity = useRef(new Animated.Value(0)).current;
  const deliveryDoveX = useRef(new Animated.Value(-26)).current;
  const deliveryDoveY = useRef(new Animated.Value(18)).current;
  const deliveryFlyRotate = useRef(new Animated.Value(0)).current;
  const deliveryWingPhase = useRef(new Animated.Value(0)).current;
  const deliveryWingLoopRef = useRef(null);
  const partnerBubbleAnim = useRef(new Animated.Value(0)).current;
  const partnerKeyboardLiftAnim = useRef(new Animated.Value(0)).current;
  const scienceStayProgress = useRef(new Animated.Value(0)).current;
  const widgetDropProgress = useRef(new Animated.Value(0)).current;
  const widgetDropWingPhase = useRef(new Animated.Value(0)).current;
  const widgetDropWingLoopRef = useRef(null);

  const {
    situation,
    hardestPart,
    bringsYouHere,
    sendMomentsStyle,
    checkInRhythm,
    partnerName,
    toggleSituation,
    toggleHardestPart,
    toggleBringsYouHere,
    toggleSendMomentsStyle,
    toggleCheckInRhythm,
    setPartnerName,
    setOnboardingData,
  } = useOnboardingStore();

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    float.start();
    return () => float.stop();
  }, [floatAnim]);

  useEffect(() => {
    if (slideIndex !== PHOTO_DELIVERY_SLIDE_INDEX) return undefined;
    deliveryAnim.setValue(0);
    deliveryDoveOpacity.setValue(1);
    deliveryDoveX.setValue(0);
    deliveryDoveY.setValue(0);
    deliveryFlyRotate.setValue(0);
    deliveryWingPhase.setValue(0);

    const cameraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(deliveryAnim, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.delay(300),
      ])
    );
    cameraLoop.start();

    deliveryWingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(deliveryWingPhase, { toValue: 1, duration: 130, useNativeDriver: false }),
        Animated.timing(deliveryWingPhase, { toValue: -1, duration: 130, useNativeDriver: false }),
      ]),
      { iterations: -1 }
    );
    deliveryWingLoopRef.current.start();

    const orbitLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(deliveryDoveX, { toValue: 26, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryDoveY, { toValue: -12, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryFlyRotate, { toValue: DELIVERY_WOBBLE_DEG, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(deliveryDoveX, { toValue: 8, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryDoveY, { toValue: -30, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryFlyRotate, { toValue: -DELIVERY_WOBBLE_DEG, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(deliveryDoveX, { toValue: -22, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryDoveY, { toValue: -10, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryFlyRotate, { toValue: DELIVERY_WOBBLE_DEG, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(deliveryDoveX, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryDoveY, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(deliveryFlyRotate, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ])
    );
    orbitLoop.start();

    return () => {
      cameraLoop.stop();
      orbitLoop.stop();
      deliveryWingLoopRef.current?.stop?.();
    };
  }, [deliveryAnim, slideIndex, deliveryDoveOpacity, deliveryDoveX, deliveryDoveY, deliveryFlyRotate, deliveryWingPhase]);

  useEffect(() => {
    if (slideIndex === PARTNER_NAME_SLIDE_INDEX) return undefined;
    setIsPartnerNameSubmitting(false);
    setSubmittedPartnerName('');
    partnerBubbleAnim.setValue(0);
    partnerKeyboardLiftAnim.setValue(0);
    return undefined;
  }, [slideIndex, partnerBubbleAnim, partnerKeyboardLiftAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 0;
      const targetLift = -Math.min(Math.round(keyboardHeight * 0.42), 170);
      Animated.timing(partnerKeyboardLiftAnim, {
        toValue: targetLift,
        duration: event?.duration ?? 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const onHide = (event) => {
      Animated.timing(partnerKeyboardLiftAnim, {
        toValue: 0,
        duration: event?.duration ?? 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [partnerKeyboardLiftAnim]);

  useEffect(() => {
    if (slideIndex !== SCIENCE_SLIDE_INDEX) return undefined;
    setScienceButtonEnabled(false);
    setScienceInsightVisible(false);
    setStayPctDisplay(0);
    scienceStayProgress.setValue(0);

    let stayCountInterval;
    const startCounter = (target, duration, setter) => {
      const start = Date.now();
      return setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        setter(Math.round(progress * target));
      }, 50);
    };

    const stayAnimTimer = setTimeout(() => {
      const stayAnim = Animated.timing(scienceStayProgress, {
        toValue: 1,
        duration: SCIENCE_ANIMATION.stayBarDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      stayAnim.start();
      stayCountInterval = startCounter(86, SCIENCE_ANIMATION.stayBarDuration, setStayPctDisplay);
    }, SCIENCE_ANIMATION.graphFillDelay);

    const insightTimer = setTimeout(() => setScienceInsightVisible(true), SCIENCE_ANIMATION.insightRevealDelay);
    const lockTimer = setTimeout(() => setScienceButtonEnabled(true), SCIENCE_ANIMATION.buttonDelay);
    return () => {
      clearTimeout(stayAnimTimer);
      clearTimeout(insightTimer);
      clearTimeout(lockTimer);
      clearInterval(stayCountInterval);
      scienceStayProgress.stopAnimation();
    };
  }, [slideIndex, scienceStayProgress]);

  useEffect(() => {
    if (slideIndex !== WIDGET_DROP_SLIDE_INDEX) {
      setWidgetDropButtonEnabled(false);
      widgetDropProgress.setValue(0);
      widgetDropWingPhase.setValue(0);
      widgetDropWingLoopRef.current?.stop?.();
      return undefined;
    }
    setWidgetDropButtonEnabled(false);
    widgetDropProgress.setValue(0);
    widgetDropWingPhase.setValue(0);

    widgetDropWingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(widgetDropWingPhase, { toValue: 1, duration: 100, useNativeDriver: false }),
        Animated.timing(widgetDropWingPhase, { toValue: -1, duration: 100, useNativeDriver: false }),
      ]),
      { iterations: -1 }
    );
    widgetDropWingLoopRef.current.start();

    const mainAnim = Animated.timing(widgetDropProgress, {
      toValue: 1,
      duration: WIDGET_DROP_ANIMATION_DURATION_MS,
      easing: RNEasing.bezier(0.33, 0, 0.2, 1),
      useNativeDriver: false,
    });
    mainAnim.start(({ finished }) => {
      widgetDropWingLoopRef.current?.stop?.();
      if (finished) setWidgetDropButtonEnabled(true);
    });

    return () => {
      mainAnim.stop();
      widgetDropWingLoopRef.current?.stop?.();
    };
  }, [slideIndex, widgetDropProgress, widgetDropWingPhase]);

  useEffect(() => {
    if (slideIndex !== CALENDAR_SLIDE_INDEX) {
      setCalendarCountdownDisplay(10);
      setCalendarConfettiVisible(false);
      setCalendarButtonEnabled(false);
      return undefined;
    }

    setCalendarCountdownDisplay(10);
    setCalendarConfettiVisible(false);
    setCalendarButtonEnabled(false);

    let current = 10;
    const interval = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        current = 0;
        setCalendarCountdownDisplay(0);
        setCalendarConfettiVisible(true);
        setCalendarButtonEnabled(true);
        clearInterval(interval);
        return;
      }
      setCalendarCountdownDisplay(current);
    }, 300);

    return () => clearInterval(interval);
  }, [slideIndex]);

  const handleGetStarted = () => setPhase('slides');
  const handleCreateAccount = () => router.replace('/auth');
  const showCTAs = phase === 'slides' && slideIndex === FINAL_SLIDE_INDEX;

  const goToSlide = (index) => {
    const i = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
    setSlideIndex(i);
  };

  const handleSlideBack = () => {
    if (slideIndex === 0) setPhase('intro');
    else goToSlide(slideIndex - 1);
  };

  /** Right-tap advance: allowed unless we're on a question slide with no selection or widget-drop/calendar (unskippable until done). */
  const canAdvance =
    (slideIndex === 0 && situation.length > 0) ||
    (slideIndex === 7 && hardestPart.length > 0) ||
    (slideIndex === 8 && bringsYouHere.length > 0) ||
    (slideIndex === 9 && sendMomentsStyle.length > 0) ||
    (slideIndex === 11 && checkInRhythm.length > 0) ||
    (slideIndex === WIDGET_DROP_SLIDE_INDEX && widgetDropButtonEnabled) ||
    (slideIndex === CALENDAR_SLIDE_INDEX && calendarButtonEnabled) ||
    (slideIndex >= 0 &&
      slideIndex < TOTAL_SLIDES - 1 &&
      ![0, 7, 8, 9, 11, PARTNER_NAME_SLIDE_INDEX, WIDGET_DROP_SLIDE_INDEX, CALENDAR_SLIDE_INDEX].includes(slideIndex));

  const handleSlideNext = () => {
    if (slideIndex === 11) {
      setOnboardingData({
        situation,
        hardestPart,
        bringsYouHere,
        sendMomentsStyle,
        checkInRhythm,
        partnerName: partnerName.trim(),
      });
    }
    if (canAdvance && slideIndex < TOTAL_SLIDES - 1) goToSlide(slideIndex + 1);
  };

  const handlePartnerNameContinue = (name, nextIndex) => {
    const trimmedName = name.trim();
    if (!trimmedName || isPartnerNameSubmitting) return;

    setOnboardingData({
      situation,
      hardestPart,
      bringsYouHere,
      sendMomentsStyle,
      checkInRhythm,
      partnerName: trimmedName,
    });
    setSubmittedPartnerName(trimmedName);
    setIsPartnerNameSubmitting(true);
    partnerBubbleAnim.setValue(0);

    Animated.sequence([
      Animated.timing(partnerBubbleAnim, {
        toValue: 0.22,
        duration: 460,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(partnerBubbleAnim, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setIsPartnerNameSubmitting(false);
      setSubmittedPartnerName('');
      goToSlide(nextIndex);
    });
  };

  const slideEntering = FadeIn.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
  const slideExiting = FadeOut.duration(120);

  /** Returns the slide content for the given index (for tap-through state-driven render). */
  function renderSlideContent(idx) {
    if ([0, 7, 8, 9, 11].includes(idx)) {
      const q =
        idx === 0 ? QUESTION_1 :
          idx === 7 ? QUESTION_2 :
            idx === 8 ? QUESTION_3 :
              idx === 9 ? QUESTION_4 :
                QUESTION_5;
      const sel =
        idx === 0 ? situation :
          idx === 7 ? hardestPart :
            idx === 8 ? bringsYouHere :
              idx === 9 ? sendMomentsStyle :
                checkInRhythm;
      const tog =
        idx === 0 ? toggleSituation :
          idx === 7 ? toggleHardestPart :
            idx === 8 ? toggleBringsYouHere :
              idx === 9 ? toggleSendMomentsStyle :
                toggleCheckInRhythm;
      return (
        <View style={[styles.slide, styles.questionSlide]}>
          <Pressable onPress={() => (idx === 0 ? setPhase('intro') : goToSlide(idx - 1))} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.questionTitle}>{q.heading}</Text>
          <ScrollView style={styles.pillScroll} contentContainerStyle={styles.pillScrollContent} showsVerticalScrollIndicator={false}>
            {q.options.map((opt) => {
              const isSelected = sel.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => tog(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.continueBtn, !(sel.length > 0) && styles.primaryButtonDisabled]}
            onPress={() => {
              if (idx === 11) {
                setOnboardingData({
                  situation,
                  hardestPart,
                  bringsYouHere,
                  sendMomentsStyle,
                  checkInRhythm,
                  partnerName: partnerName.trim(),
                });
              }
              goToSlide(idx + 1);
            }}
            disabled={sel.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (idx === PARTNER_NAME_SLIDE_INDEX) {
      const trimmedName = partnerName.trim();
      const inputOpacity = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.15, 0.22, 1],
        outputRange: [1, 0.75, 0, 0],
      });
      const inputScaleX = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.22, 1],
        outputRange: [1, 0.54, 0.54],
      });
      const inputScaleY = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.22, 1],
        outputRange: [1, 0.54, 0.54],
      });
      const bubbleTranslateY = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.22, 1],
        outputRange: [0, -8, -340],
      });
      const bubbleOpacity = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.1, 0.22, 0.9, 1],
        outputRange: [0, 0, 1, 1, 0],
      });
      const bubbleScale = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.22, 1],
        outputRange: [0.72, 1, 1.1],
      });
      const bubbleGlowOpacity = partnerBubbleAnim.interpolate({
        inputRange: [0, 0.22, 0.5, 1],
        outputRange: [0, 0.85, 0.4, 0],
      });
      const sparkleOffset = partnerBubbleAnim.interpolate({
        inputRange: [0.22, 1],
        outputRange: [0, 26],
      });
      return (
        <View style={[styles.slide, styles.questionSlide]}>
          <Pressable onPress={() => !isPartnerNameSubmitting && goToSlide(idx - 1)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.questionTitle}>{"What's your partner's name?"}</Text>
          <Text style={styles.namePrompt}>{"We'll use this to personalize your Duva moments."}</Text>
          <View style={styles.partnerBubbleArea} />
          <Animated.View style={[styles.partnerInputActionsWrap, { transform: [{ translateY: partnerKeyboardLiftAnim }] }]}>
            <Animated.View
              style={[
                styles.nameInputWrap,
                {
                  opacity: inputOpacity,
                  transform: [{ scaleX: inputScaleX }, { scaleY: inputScaleY }],
                },
              ]}
            >
              {!isPartnerNameSubmitting && (
                <TextInput
                  value={partnerName}
                  onChangeText={setPartnerName}
                  placeholder="Type their name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.nameInput}
                />
              )}
            </Animated.View>
            {!isPartnerNameSubmitting && (
              <TouchableOpacity
                style={[styles.partnerContinueBtn, !(trimmedName.length > 0) && styles.primaryButtonDisabled]}
                onPress={() => {
                  handlePartnerNameContinue(trimmedName, idx + 1);
                }}
                disabled={trimmedName.length === 0}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
          {isPartnerNameSubmitting && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.partnerBubbleOverlay,
                {
                  opacity: bubbleOpacity,
                  transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }],
                },
              ]}
            >
              <Animated.View style={[styles.partnerBubbleGlow, { opacity: bubbleGlowOpacity }]} />
              <Ionicons name="heart" size={164} color={colors.blushDark} />
              <View style={styles.partnerBubbleTextWrap}>
                <Text numberOfLines={2} style={styles.partnerBubbleText}>
                  {submittedPartnerName}
                </Text>
              </View>
              <Animated.View style={[styles.partnerSparkle, styles.partnerSparkleLeft, { transform: [{ translateY: sparkleOffset }] }]} />
              <Animated.View style={[styles.partnerSparkle, styles.partnerSparkleRight, { transform: [{ translateY: sparkleOffset }] }]} />
            </Animated.View>
          )}
        </View>
      );
    }
    if (idx === PHOTO_DELIVERY_SLIDE_INDEX) {
      const doveTranslateX = deliveryAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [-4, 6, -4],
      });
      const doveTranslateY = deliveryAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [2, -4, 2],
      });
      const flyRotateStr = deliveryFlyRotate.interpolate({
        inputRange: [-DELIVERY_WOBBLE_DEG, DELIVERY_WOBBLE_DEG],
        outputRange: [`-${DELIVERY_WOBBLE_DEG}deg`, `${DELIVERY_WOBBLE_DEG}deg`],
      });
      return (
        <View style={styles.slide}>
          <View style={styles.deliveryStage}>
            <Animated.View
              style={[
                styles.doveDelivery,
                {
                  opacity: deliveryDoveOpacity,
                  transform: [
                    { translateX: Animated.add(doveTranslateX, deliveryDoveX) },
                    { translateY: Animated.add(doveTranslateY, deliveryDoveY) },
                    { rotate: flyRotateStr },
                  ],
                },
              ]}
            >
              <Dove
                size={DELIVERY_DOVE_SIZE}
                leftWingRotation={deliveryWingPhase}
                rightWingRotation={deliveryWingPhase}
                outlineColor={colors.blushDark}
                outlineWidth={1.6}
                hideBeak
              />
              <View style={styles.doveCarryMiniCard} />
            </Animated.View>
          </View>
          <Text style={styles.slideTitle}>{FEATURE_TITLES[0]}</Text>
          <Text style={styles.slideSubtitle}>Then watch our little dove whisk it away to your partner.</Text>
        </View>
      );
    }
    if (idx === SCIENCE_SLIDE_INDEX) {
      const stayWidth = scienceStayProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '86%'],
      });
      return (
        <View style={[styles.slide, styles.scienceSlide]}>
          <AnimatedReanimated.View
            entering={FadeIn.delay(SCIENCE_ANIMATION.titleDelay).duration(200).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}
            style={styles.scienceHeaderBlock}
          >
            <Text style={styles.scienceHeadline}>The Science of Staying Together</Text>
          </AnimatedReanimated.View>

          <AnimatedReanimated.View
            entering={FadeIn.delay(SCIENCE_ANIMATION.sentence1Delay).duration(200)}
            style={styles.scienceSubtitleBlock}
          >
            <Text style={styles.scienceSubtitleText}>
              Small daily check-ins are called "bids for connection."
            </Text>
          </AnimatedReanimated.View>

          <AnimatedReanimated.View
            entering={FadeIn.delay(SCIENCE_ANIMATION.sentence2Delay).duration(200)}
            style={styles.scienceSubtitleBlock}
          >
            <Text style={styles.scienceSubtitleText}>
              One photo a day can keep your shared world alive.
            </Text>
          </AnimatedReanimated.View>

          <AnimatedReanimated.View
            entering={FadeIn.delay(SCIENCE_ANIMATION.graphRevealDelay).duration(650).withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
            style={[styles.scienceInfographic, styles.scienceInfographicBottom]}
          >
            <View style={styles.scienceRow}>
              <Text style={styles.sciencePct}>{stayPctDisplay}%</Text>
              <View style={styles.scienceTrack}>
                <Animated.View style={[styles.scienceFill, styles.scienceFillStay, { width: stayWidth }]} />
              </View>
            </View>
          </AnimatedReanimated.View>

          {scienceInsightVisible && (
            <AnimatedReanimated.View entering={FadeIn.duration(500)} style={styles.scienceInsightWrap}>
              <Text style={styles.scienceInsightText}>
                86% of long term happy couples report sharing atleast one bid for connection a day
              </Text>
            </AnimatedReanimated.View>
          )}

          <AnimatedReanimated.View
            entering={FadeIn.delay(SCIENCE_ANIMATION.buttonDelay).duration(500)}
            style={styles.scienceCtaWrap}
          >
            <TouchableOpacity
              style={[styles.primaryButton, !scienceButtonEnabled && styles.primaryButtonDisabled]}
              onPress={() => goToSlide(idx + 1)}
              disabled={!scienceButtonEnabled}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Make every day count</Text>
            </TouchableOpacity>
          </AnimatedReanimated.View>
        </View>
      );
    }
    if (idx === WIDGET_DROP_SLIDE_INDEX) {
      // Dove flies in from left, above the phone, then hovers above it and drops the photo
      const doveFlyX = widgetDropProgress.interpolate({
        inputRange: [0, 0.35, 0.5, 0.75, 1],
        outputRange: [-100, -8, 0, 0, 20],
      });
      const doveFlyY = widgetDropProgress.interpolate({
        inputRange: [0, 0.35, 0.5, 0.6, 0.85, 1],
        outputRange: [-140, -100, -100, -100, -130, -150],
      });
      // Card is held by dove then drops down onto the widget slot
      const cardCarryY = widgetDropProgress.interpolate({
        inputRange: [0, 0.5, 0.58, 0.78, 1],
        outputRange: [0, 0, 0, 42, 42],
      });
      const cardOpacity = widgetDropProgress.interpolate({
        inputRange: [0, 0.72, 0.8, 0.9, 1],
        outputRange: [1, 1, 0.6, 0.05, 0],
      });
      const widgetPhotoOpacity = widgetDropProgress.interpolate({
        inputRange: [0.65, 0.82, 1],
        outputRange: [0, 1, 1],
      });
      const doveOpacity = widgetDropProgress.interpolate({
        inputRange: [0.7, 0.85, 1],
        outputRange: [1, 0.4, 0],
      });
      const flyRotateStr = widgetDropWingPhase.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-8deg', '8deg'],
      });
      return (
        <View style={styles.slide}>
          <View style={styles.widgetDropStage}>
            <View style={styles.iphoneFrame}>
              <View style={styles.iphoneScreen}>
                <View style={styles.iphoneWidgetSlot}>
                  <Animated.View style={[styles.widgetDropPhotoWrap, { opacity: widgetPhotoOpacity }]}>
                    <Image source={WIDGET_COFFEE_IMAGE} style={styles.widgetDropPhoto} resizeMode="cover" />
                  </Animated.View>
                </View>
              </View>
            </View>
            <Animated.View
              style={[
                styles.widgetDropDoveWrap,
                {
                  opacity: doveOpacity,
                  transform: [
                    { translateX: doveFlyX },
                    { translateY: doveFlyY },
                    { rotate: flyRotateStr },
                  ],
                },
              ]}
            >
              <Dove
                size={44}
                leftWingRotation={widgetDropWingPhase}
                rightWingRotation={widgetDropWingPhase}
                outlineColor={colors.blushDark}
                outlineWidth={1.2}
                hideBeak
              />
              <Animated.View style={[styles.widgetDropCarryCard, { opacity: cardOpacity, transform: [{ translateY: cardCarryY }] }]}>
                <Image source={WIDGET_COFFEE_IMAGE} style={styles.widgetDropCarryPhoto} resizeMode="cover" />
              </Animated.View>
            </Animated.View>
          </View>
          <Text style={styles.slideTitle}>...RIGHT TO YOUR PARTNER'S HOME SCREEN.</Text>
          <Text style={styles.slideSubtitle}>Our dove delivers your latest photo straight to your partner's Duva widget—so they can see it the moment they unlock.</Text>
          <AnimatedReanimated.View style={styles.widgetDropCtaWrap}>
            <TouchableOpacity
              style={[styles.primaryButton, !widgetDropButtonEnabled && styles.primaryButtonDisabled]}
              onPress={() => goToSlide(idx + 1)}
              disabled={!widgetDropButtonEnabled}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </AnimatedReanimated.View>
        </View>
      );
    }
    if (idx === CALENDAR_SLIDE_INDEX) {
      return (
        <View style={styles.slide}>
          <View style={styles.calendarSlideStage}>
            <View style={[styles.iphoneFrame, styles.calendarIphoneFrame]}>
              <View style={[styles.iphoneScreen, styles.calendarIphoneScreen]}>
                <View style={[styles.calendarWidgetSlot, styles.calendarWidgetSlotLarge]}>
                  <AnimatedReanimated.View
                    entering={FadeIn.delay(200).duration(400).withInitialValues({ opacity: 0, transform: [{ scale: 0.92 }] })}
                    style={StyleSheet.absoluteFill}
                  >
                    <Image source={WIDGET_COFFEE_IMAGE} style={styles.calendarWidgetBg} resizeMode="cover" />
                    <View style={styles.calendarWidgetOverlay} />
                  </AnimatedReanimated.View>
                  <AnimatedReanimated.View
                    entering={FadeIn.delay(500).duration(350).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}
                    style={styles.calendarWidgetContent}
                  >
                    <View style={styles.calendarWidgetLabelWrap}>
                      <Text style={[styles.calendarWidgetLabel, styles.calendarWidgetLabelLarge]}>SEEING THEM IN</Text>
                    </View>
                    <AnimatedReanimated.View
                      entering={FadeIn.delay(700).duration(300).withInitialValues({ opacity: 0, transform: [{ scale: 0.6 }] })}
                    >
                      <CalendarCountdownPulse>
                        <Text key={calendarCountdownDisplay} style={[styles.calendarWidgetNumber, styles.calendarWidgetNumberLarge]}>
                          {calendarCountdownDisplay}
                        </Text>
                      </CalendarCountdownPulse>
                    </AnimatedReanimated.View>
                    <Text style={[styles.calendarWidgetDays, styles.calendarWidgetDaysLarge]}>DAYS</Text>
                  </AnimatedReanimated.View>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.calendarSlideTextBlock}>
            <AnimatedReanimated.View
              entering={FadeIn.delay(400).duration(1200).withInitialValues({ opacity: 0 })}
              style={styles.calendarSlideTitleWrap}
            >
              <Text style={[styles.slideTitle, styles.calendarSlideTitle]}>{FEATURE_TITLES[5]}</Text>
              <Text style={[styles.slideSubtitle, styles.calendarSlideSubtitle]}>
                Add the Duva Countdown widget to see days until you're together.
              </Text>
            </AnimatedReanimated.View>
            <View style={styles.calendarSlideButtonSlot}>
              {calendarButtonEnabled && (
                <AnimatedReanimated.View entering={FadeIn.duration(400)} style={styles.calendarSlideButtonWrap}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => goToSlide(idx + 1)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </AnimatedReanimated.View>
              )}
            </View>
          </View>
          <ConfettiBurst visible={calendarConfettiVisible} onDone={() => setCalendarConfettiVisible(false)} />
        </View>
      );
    }
    if (idx === 2) {
      return (
        <View style={styles.slide}>
          <View style={styles.slide1Content}>
            <View style={styles.collageContainer}>
              {STOCK_IMAGES.map((src, i) => {
                const [top, leftVal, rightVal, rotate, zIndex, isHero] = COLLAGE_LAYOUT[i];
                const imgSize = isHero ? HERO_IMAGE_SIZE : CARD_IMAGE_SIZE;
                const wrapperW = isHero ? HERO_WRAPPER_W : CARD_WRAPPER_W;
                const wrapperH = isHero ? HERO_WRAPPER_H : CARD_WRAPPER_H;
                const innerWrapper = (
                  <View
                    style={[
                      styles.postcardWrapper,
                      styles.postcardWrapperHeroInner,
                      { transform: [{ rotate: `${rotate}deg` }], backgroundColor: POSTCARD_PASTELS[i], width: wrapperW, height: wrapperH },
                    ]}
                  >
                    <Image source={src} style={[styles.postcardImage, { width: imgSize, height: imgSize }]} resizeMode="cover" />
                  </View>
                );
                if (isHero) return <View key={i} style={[styles.heroCardOuter, { top, zIndex }]}>{innerWrapper}</View>;
                return (
                  <View
                    key={i}
                    style={[
                      styles.postcardWrapper,
                      {
                        top,
                        ...(leftVal != null && { left: leftVal }),
                        ...(rightVal != null && { right: rightVal }),
                        transform: [{ rotate: `${rotate}deg` }],
                        zIndex,
                        backgroundColor: POSTCARD_PASTELS[i],
                        width: wrapperW,
                        height: wrapperH,
                      },
                    ]}
                  >
                    <Image source={src} style={[styles.postcardImage, { width: imgSize, height: imgSize }]} resizeMode="cover" />
                  </View>
                );
              })}
              <View style={styles.doveIconWrapOuter}>
                <View style={styles.doveIconWrap}>
                  <Ionicons name="paper-plane" size={40} color={colors.blushDark} />
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.slideTitle}>{FEATURE_TITLES[1]}</Text>
          <Text style={styles.slideSubtitle}>Send puffy postcards and little moments.</Text>
        </View>
      );
    }
    if (idx === 10) {
      return (
        <View style={styles.slide}>
          <View style={styles.slide2Content}>
            <View style={styles.locationWeatherRow}>
              <View style={styles.puffyCard}>
                <Ionicons name="location" size={28} color={colors.blushDark} />
                <Text style={styles.puffyCardLabel}>Location</Text>
              </View>
              <View style={styles.puffyCard}>
                <Ionicons name="partly-sunny-outline" size={28} color={colors.skyDark} />
                <Text style={styles.puffyCardLabel}>Weather</Text>
              </View>
            </View>
            <View style={styles.calendarCountdownRow}>
              <View style={styles.puffyCardWide}>
                <Ionicons name="calendar" size={32} color={colors.blushDark} />
                <Text style={styles.puffyCardLabel}>Shared calendar</Text>
              </View>
              <View style={styles.puffyCardWide}>
                <Text style={styles.countdownBig}>42</Text>
                <Text style={styles.puffyCardLabel}>days to go</Text>
              </View>
            </View>
          </View>
          <Text style={styles.slideTitle}>{FEATURE_TITLES[2]}</Text>
          <Text style={styles.slideSubtitle}>See where they are, what it's like there, and count down until you're together.</Text>
        </View>
      );
    }
    if (idx === 12) {
      return (
        <View style={styles.slide}>
          <View style={styles.slide3Dashboard}>
            <View style={styles.widgetRow}>
              <View style={styles.puffyCard}>
                <Ionicons name="time-outline" size={28} color={colors.blushDark} />
                <Text style={styles.puffyCardLabel}>Time</Text>
              </View>
              <View style={styles.puffyCard}>
                <Ionicons name="partly-sunny-outline" size={28} color={colors.skyDark} />
                <Text style={styles.puffyCardLabel}>Weather</Text>
              </View>
              <View style={styles.puffyCard}>
                <Ionicons name="battery-half-outline" size={28} color={colors.textMuted} />
                <Text style={styles.puffyCardLabel}>Battery</Text>
              </View>
            </View>
          </View>
          <Text style={styles.slideTitle}>{FEATURE_TITLES[3]}</Text>
          <Text style={styles.slideSubtitle}>One cozy home screen. Their time, weather, and battery—always in reach.</Text>
          <View style={styles.slide3WidgetsAboveCTA}>
            <View style={styles.miniWidgetRow}>
              <View style={styles.miniWidget}>
                <Ionicons name="location" size={20} color={colors.blushDark} />
                <Text style={styles.miniWidgetText}>Location</Text>
              </View>
              <View style={styles.miniWidget}>
                <Ionicons name="partly-sunny-outline" size={20} color={colors.skyDark} />
                <Text style={styles.miniWidgetText}>Weather</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }
    // idx === 13 (final)
    return (
      <View style={styles.slide}>
        <View style={styles.slideCoupleSubscription}>
          <View style={styles.coupleSubscriptionRow}>
            <View style={[styles.puffyCard, styles.coupleSubscriptionCard]}>
              <Ionicons name="person" size={32} color={colors.blushDark} />
              <Text style={styles.puffyCardLabel}>You</Text>
            </View>
            <View style={styles.coupleSubscriptionHeart}>
              <Ionicons name="heart" size={36} color={colors.blushDark} />
            </View>
            <View style={[styles.puffyCard, styles.coupleSubscriptionCard]}>
              <Ionicons name="person" size={32} color={colors.blushDark} />
              <Text style={styles.puffyCardLabel}>Partner</Text>
            </View>
          </View>
          <View style={styles.coupleSubscriptionBadge}>
            <View style={[styles.puffyCardWide, styles.coupleSubscriptionBadgeCard]}>
              <Ionicons name="checkmark-circle" size={28} color={colors.blushDark} />
              <Text style={styles.puffyCardLabel}>One subscription</Text>
              <Text style={styles.coupleSubscriptionBadgeSub}>covers you both</Text>
            </View>
          </View>
        </View>
        <Text style={styles.slideTitle}>{FEATURE_TITLES[4]}</Text>
        <Text style={styles.slideSubtitle}>
          Only one of you needs to subscribe. When either partner pays, you both get full access—no extra charge.
        </Text>
      </View>
    );
  }

  // —— Intro: app name, icon, animated background, Get Started ——
  if (phase === 'intro') {
    const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
    const opacity = floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.7, 0.4] });
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.introBg}>
          <Animated.View style={[styles.introCircle, styles.introCircle1, { opacity, transform: [{ translateY }] }]} />
          <Animated.View style={[styles.introCircle, styles.introCircle2, { opacity: opacity, transform: [{ translateY }] }]} />
          <Animated.View style={[styles.introCircle, styles.introCircle3, { opacity, transform: [{ translateY }] }]} />
        </View>
        <View style={styles.introContent}>
          <Animated.View style={[styles.introIconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="heart" size={56} color={colors.blushDark} />
          </Animated.View>
          <Text style={styles.introAppName}>Duva</Text>
          <Text style={styles.introTagline}>Close the distance.</Text>
        </View>
        <View style={styles.introBottom}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
          <Pressable onPress={handleCreateAccount} style={styles.secondaryLink} accessibilityRole="link">
            <Text style={styles.secondaryLinkText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Extended onboarding: questionnaire + animation + features.
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>YOUR STORY BEGINS...</Text>
        <Text style={styles.headerStep}>Step {slideIndex + 1} of {TOTAL_SLIDES}</Text>
        <SegmentedProgressBar segments={TOTAL_SLIDES} activeIndex={slideIndex} />
      </View>

      <View style={styles.carouselWrap}>
        <LDRBackground totalSlides={TOTAL_SLIDES} currentSlideIndex={slideIndex} hideMovingElement={slideIndex === WIDGET_DROP_SLIDE_INDEX} />
        <View style={styles.slideContainer}>
          <AnimatedReanimated.View
            key={slideIndex}
            entering={slideEntering}
            exiting={slideExiting}
            style={styles.slideWrapper}
          >
            {renderSlideContent(slideIndex)}
          </AnimatedReanimated.View>
        </View>
        {/* Tap-through overlay on photo animation + feature slides; question/science/final are button-driven */}
        {(slideIndex === PHOTO_DELIVERY_SLIDE_INDEX || FEATURE_SLIDE_INDICES.includes(slideIndex)) && (
          <View style={styles.tapOverlay}>
            <Pressable style={styles.tapZoneLeft} onPress={handleSlideBack} />
            <Pressable style={styles.tapZoneRight} onPress={handleSlideNext} />
          </View>
        )}
      </View>

      {showCTAs && (
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateAccount} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>LET'S GO!</Text>
          </TouchableOpacity>
          <Pressable onPress={handleCreateAccount} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>Log in to existing account</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  introBg: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  introCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.blush + '50',
  },
  introCircle1: {
    width: 200,
    height: 200,
    top: 80,
    left: -60,
  },
  introCircle2: {
    width: 160,
    height: 160,
    top: 220,
    right: -40,
  },
  introCircle3: {
    width: 120,
    height: 120,
    bottom: 200,
    left: 80,
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  introIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...SHADOW,
  },
  introAppName: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  introTagline: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '600',
  },
  introBottom: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerStep: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.blush + '60',
  },
  progressSegmentEmpty: {
    backgroundColor: colors.blush + '60',
  },
  progressSegmentFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.blushDark,
    borderRadius: 3,
  },
  carouselWrap: {
    flex: 1,
    position: 'relative',
  },
  slideContainer: {
    flex: 1,
    width: '100%',
  },
  slideWrapper: {
    flex: 1,
    width: '100%',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10,
  },
  tapZoneLeft: {
    flex: 0.3,
    width: '30%',
  },
  tapZoneRight: {
    flex: 0.7,
    width: '70%',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  questionSlide: {
    paddingTop: 12,
  },
  backButton: {
    position: 'absolute',
    left: 28,
    top: 20,
    zIndex: 5,
    padding: 8,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  namePrompt: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  partnerBubbleArea: {
    height: 190,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  partnerBubbleWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  partnerBubbleText: {
    maxWidth: 126,
    textAlign: 'center',
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 21,
  },
  partnerBubbleTextWrap: {
    position: 'absolute',
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBubbleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 370,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  partnerBubbleGlow: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.blush + '66',
  },
  partnerSparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blushDark,
  },
  partnerSparkleLeft: {
    left: 110,
    top: 18,
  },
  partnerSparkleRight: {
    right: 112,
    top: 48,
  },
  nameInputWrap: {
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 30,
  },
  partnerInputActionsWrap: {
    width: '100%',
  },
  partnerContinueBtn: {
    marginTop: 18,
    marginHorizontal: 28,
    backgroundColor: colors.blushDark,
    borderRadius: RADIUS,
    paddingVertical: 18,
    alignItems: 'center',
    ...SHADOW,
  },
  nameInput: {
    width: '100%',
    backgroundColor: colors.surface + 'F0',
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.blush + '99',
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
    ...SHADOW,
  },
  pillScroll: {
    flex: 1,
    width: '100%',
  },
  pillScrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  pill: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: RADIUS,
    backgroundColor: colors.surface + 'E6',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 14,
    ...SHADOW,
  },
  pillSelected: {
    backgroundColor: colors.blush + '99',
    borderColor: colors.blushDark,
  },
  pillText: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: colors.text,
  },
  continueBtn: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 32,
    backgroundColor: colors.blushDark,
    borderRadius: RADIUS,
    paddingVertical: 18,
    alignItems: 'center',
    ...SHADOW,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 170,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  slideSubtitle: {
    fontSize: 17,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  calendarSlideTitle: {
    fontSize: 30,
    lineHeight: 34,
    marginTop: 0,
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  calendarSlideSubtitle: {
    fontSize: 19,
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  scienceSlide: {
    backgroundColor: '#FFF8F1',
    alignItems: 'stretch',
    paddingTop: 8,
  },
  scienceHeaderBlock: {
    marginTop: 8,
    marginBottom: 22,
  },
  scienceHeadline: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 40,
    textAlign: 'center',
  },
  scienceInfographic: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.blush + '77',
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: 22,
    ...SHADOW,
  },
  scienceInfographicBottom: {
    marginTop: 6,
    marginBottom: 14,
  },
  scienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sciencePct: {
    width: 92,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  scienceTrack: {
    flex: 1,
    height: 22,
    borderRadius: 14,
    backgroundColor: '#E6E3E1',
    overflow: 'hidden',
  },
  scienceFill: {
    height: '100%',
    borderRadius: 14,
  },
  scienceFillStay: {
    backgroundColor: colors.blushDark,
  },
  scienceLabelProminent: {
    fontSize: 17,
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 0,
    textAlign: 'center',
  },
  scienceInsightWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  scienceInsightText: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  scienceSubtitleBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scienceSubtitleText: {
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  scienceCtaWrap: {
    marginTop: 'auto',
    paddingBottom: 12,
  },
  slide1Content: {
    alignItems: 'center',
    marginTop: 10,
  },
  deliveryStage: {
    width: '100%',
    height: 240,
    marginTop: 24,
    marginBottom: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBubble: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  cameraFlash: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.white,
  },
  photoCardAnimated: {
    position: 'absolute',
    left: 48,
    top: 120,
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  doveDelivery: {
    position: 'absolute',
    left: 72,
    top: 114,
    width: 140,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doveCarryMiniCard: {
    position: 'absolute',
    bottom: 14,
    width: 28,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.blushDark,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  widgetDropStage: {
    width: '100%',
    height: 260,
    marginTop: 8,
    marginBottom: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iphoneFrame: {
    width: 100,
    height: 200,
    borderRadius: 24,
    padding: 7,
    backgroundColor: '#1c1c1e',
    ...SHADOW,
  },
  iphoneScreen: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  iphoneWidgetSlot: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 16,
    height: 88,
    borderRadius: 12,
    backgroundColor: 'rgb(255, 248, 245)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetDropPhotoWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
  },
  widgetDropPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  widgetDropDoveWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -60,
    marginTop: -40,
    width: 120,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetDropCarryCard: {
    position: 'absolute',
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.blushDark,
    ...SHADOW,
  },
  widgetDropCarryPhoto: {
    width: 36,
    height: 36,
  },
  widgetDropCtaWrap: {
    marginTop: 16,
    width: '100%',
  },
  calendarSlideStage: {
    width: '100%',
    height: 340,
    marginTop: 8,
    marginBottom: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIphoneFrame: {
    width: 152,
    height: 304,
    padding: 10,
    borderRadius: 32,
  },
  calendarIphoneScreen: {
    borderRadius: 20,
  },
  calendarWidgetSlot: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 16,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWidgetSlotLarge: {
    left: 10,
    right: 10,
    top: 24,
    height: 132,
    borderRadius: 16,
  },
  calendarSlideTextBlock: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
    width: '100%',
  },
  calendarSlideTitleWrap: {
    width: '100%',
  },
  calendarSlideButtonSlot: {
    minHeight: 72,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  calendarSlideButtonWrap: {
    width: '100%',
  },
  calendarWidgetBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  calendarWidgetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  calendarWidgetContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWidgetLabelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  calendarWidgetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1.5,
    textAlign: 'center',
    ...glassTextShadow,
  },
  calendarWidgetLabelLarge: {
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 4,
  },
  calendarWidgetNumberWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWidgetNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    ...glassTextShadow,
  },
  calendarWidgetNumberLarge: {
    fontSize: 46,
  },
  calendarWidgetDays: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
    ...glassTextShadow,
  },
  calendarWidgetDaysLarge: {
    fontSize: 20,
    letterSpacing: 1.5,
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 3,
    opacity: 0,
  },
  collageContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
    marginBottom: 8,
  },
  heroCardOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  postcardWrapper: {
    position: 'absolute',
    padding: CARD_PADDING,
    paddingBottom: CARD_CHIN,
    borderRadius: 20,
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  postcardWrapperHeroInner: {
    position: 'relative',
  },
  postcardImage: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  doveIconWrapOuter: {
    position: 'absolute',
    bottom: -170,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  doveIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  slide2Content: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  locationWeatherRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  calendarCountdownRow: {
    flexDirection: 'row',
    gap: 16,
  },
  puffyCard: {
    minWidth: 100,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: RADIUS,
    backgroundColor: colors.surface,
    alignItems: 'center',
    ...SHADOW,
  },
  puffyCardWide: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: RADIUS,
    backgroundColor: colors.blush + '40',
    borderWidth: 2,
    borderColor: colors.blushDark + '99',
    alignItems: 'center',
    ...SHADOW,
  },
  puffyCardLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: 10,
  },
  countdownBig: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
  },
  slide3Dashboard: {
    width: '100%',
    marginTop: 10,
  },
  widgetRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  slide3WidgetsAboveCTA: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  miniWidgetRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  miniWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS,
    backgroundColor: colors.surface,
    ...SHADOW,
  },
  miniWidgetText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  slideCoupleSubscription: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  coupleSubscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  coupleSubscriptionCard: {
    minWidth: 88,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  coupleSubscriptionHeart: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blush + '60',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  coupleSubscriptionBadge: {
    width: '100%',
    maxWidth: 280,
  },
  coupleSubscriptionBadgeCard: {
    flex: undefined,
    alignItems: 'center',
  },
  coupleSubscriptionBadgeSub: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
    backgroundColor: colors.background,
  },
  primaryButton: {
    backgroundColor: colors.blushDark,
    borderRadius: RADIUS,
    paddingVertical: 20,
    alignItems: 'center',
    ...SHADOW,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  secondaryLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryLinkText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
