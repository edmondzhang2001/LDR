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
  Animated,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { LDRBackground } from './LDRBackground';

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

const FEATURE_TITLES = ['YOUR FIRST IMPRESSIONS.', 'BRIDGE THE DISTANCE.', 'OUR MAGIC.', 'ONE SUBSCRIPTION. BOTH OF YOU.'];
const TOTAL_SLIDES = 7;

const SEGMENT_FILL_DURATION = 280;

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

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const { situation, hardestPart, bringsYouHere, toggleSituation, toggleHardestPart, toggleBringsYouHere, setOnboardingData } =
    useOnboardingStore();

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

  const handleGetStarted = () => setPhase('slides');
  const handleCreateAccount = () => router.replace('/auth');
  const showCTAs = phase === 'slides' && slideIndex === 6;

  const goToSlide = (index) => {
    const i = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
    setSlideIndex(i);
  };

  const handleSlideBack = () => {
    if (slideIndex === 0) setPhase('intro');
    else goToSlide(slideIndex - 1);
  };

  /** Right-tap advance: allowed unless we're on a question slide with no selection. */
  const canAdvance =
    slideIndex <= 2
      ? (slideIndex === 0 && situation.length > 0) ||
        (slideIndex === 1 && hardestPart.length > 0) ||
        (slideIndex === 2 && bringsYouHere.length > 0)
      : slideIndex < TOTAL_SLIDES - 1;

  const handleSlideNext = () => {
    if (slideIndex === 2) setOnboardingData({ situation, hardestPart, bringsYouHere });
    if (canAdvance && slideIndex < TOTAL_SLIDES - 1) goToSlide(slideIndex + 1);
  };

  const slideEntering = FadeIn.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
  const slideExiting = FadeOut.duration(120);

  /** Returns the slide content for the given index (for tap-through state-driven render). */
  function renderSlideContent(idx) {
    if (idx <= 2) {
      const q = [QUESTION_1, QUESTION_2, QUESTION_3][idx];
      const sel = idx === 0 ? situation : idx === 1 ? hardestPart : bringsYouHere;
      const tog = idx === 0 ? toggleSituation : idx === 1 ? toggleHardestPart : toggleBringsYouHere;
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
              if (idx === 2) setOnboardingData({ situation, hardestPart, bringsYouHere });
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
    if (idx === 3) {
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
          <Text style={styles.slideTitle}>{FEATURE_TITLES[0]}</Text>
          <Text style={styles.slideSubtitle}>Send puffy postcards and little moments. Watch them fly to your person.</Text>
        </View>
      );
    }
    if (idx === 4) {
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
          <Text style={styles.slideTitle}>{FEATURE_TITLES[1]}</Text>
          <Text style={styles.slideSubtitle}>See where they are, what it's like there, and count down until you're together.</Text>
        </View>
      );
    }
    if (idx === 5) {
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
          <Text style={styles.slideTitle}>{FEATURE_TITLES[2]}</Text>
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
    // idx === 6
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
        <Text style={styles.slideTitle}>{FEATURE_TITLES[3]}</Text>
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
        </View>
      </SafeAreaView>
    );
  }

  // —— 6 slides: 3 questionnaire + 3 features ——
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>YOUR STORY BEGINS...</Text>
        <Text style={styles.headerStep}>Step {slideIndex + 1} of {TOTAL_SLIDES}</Text>
        <SegmentedProgressBar segments={TOTAL_SLIDES} activeIndex={slideIndex} />
      </View>

      <View style={styles.carouselWrap}>
        <LDRBackground totalSlides={TOTAL_SLIDES} currentSlideIndex={slideIndex} />
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
        {/* Tap-through overlay only on feature slides 3–5; survey (0–2) and last slide (6) use buttons */}
        {slideIndex >= 3 && slideIndex < 6 && (
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
  slide1Content: {
    alignItems: 'center',
    marginTop: 10,
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
