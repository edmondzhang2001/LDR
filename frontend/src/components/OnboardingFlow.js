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
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useOnboardingStore } from '../store/useOnboardingStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STREAK_WIDTH = SCREEN_WIDTH * 3;
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

const FEATURE_TITLES = ['YOUR FIRST IMPRESSIONS.', 'BRIDGE THE DISTANCE.', 'OUR MAGIC.'];
const TOTAL_SLIDES = 6;

function SegmentedProgress({ segments, activeIndex }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i <= activeIndex ? styles.progressSegmentFilled : styles.progressSegmentEmpty,
          ]}
        />
      ))}
    </View>
  );
}

/** Continuous curvy streak (dove flight path) spanning the 3 feature slides. */
function FlightPathStreak() {
  const W = STREAK_WIDTH;
  const H = CONTAINER_HEIGHT;
  // Single path: start left of slide 1 → swoop under photo stack → curve up into slide 2 → loop → dip to slide 3 → end near LET'S GO
  const pathD = [
    `M 0 ${0.28 * H}`,
    `C ${0.08 * W} ${0.38 * H}, ${0.2 * W} ${0.52 * H}, ${0.28 * W} ${0.5 * H}`,
    `S ${0.42 * W} ${0.32 * H}, ${0.5 * W} ${0.32 * H}`,
    `C ${0.58 * W} ${0.32 * H}, ${0.68 * W} ${0.24 * H}, ${0.78 * W} ${0.22 * H}`,
    `S ${0.92 * W} ${0.2 * H}, ${0.98 * W} ${0.22 * H}`,
    `C ${1.04 * W} ${0.24 * H}, ${1.08 * W} ${0.3 * H}, ${1.12 * W} ${0.28 * H}`,
    `S ${1.22 * W} ${0.18 * H}, ${1.3 * W} ${0.2 * H}`,
    `C ${1.42 * W} ${0.24 * H}, ${1.55 * W} ${0.38 * H}, ${1.68 * W} ${0.4 * H}`,
    `C ${1.82 * W} ${0.42 * H}, ${2 * W} ${0.55 * H}, ${2.2 * W} ${0.62 * H}`,
    `C ${2.45 * W} ${0.72 * H}, ${2.75 * W} ${0.82 * H}, ${W} ${0.88 * H}`,
  ].join(' ');

  return (
    <View
      style={[
        styles.flightPathStreakContainer,
        { width: STREAK_WIDTH, left: SCREEN_WIDTH * 3 },
      ]}
      pointerEvents="none"
    >
      <Svg width="100%" height={CONTAINER_HEIGHT} style={styles.flightPathSvg}>
        <Path
          d={pathD}
          fill="none"
          stroke="rgba(232, 160, 166, 0.45)"
          strokeWidth={3}
          strokeDasharray="8, 12"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState('intro');
  const [slideIndex, setSlideIndex] = useState(0);
  const scrollRef = useRef(null);

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
  const showCTAs = phase === 'slides' && slideIndex === 5;

  const goToSlide = (index) => {
    const i = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setSlideIndex(i);
  };

  const handleSlideBack = () => {
    if (slideIndex === 0) setPhase('intro');
    else goToSlide(slideIndex - 1);
  };

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
          <Text style={styles.introAppName}>LDR</Text>
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
        <SegmentedProgress segments={TOTAL_SLIDES} activeIndex={slideIndex} />
      </View>

      <View style={styles.carouselWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setSlideIndex(i);
          }}
          style={styles.carouselScroll}
        >
          <FlightPathStreak />
          {/* Slides 0–2: Questionnaire (multi-select) */}
          {[QUESTION_1, QUESTION_2, QUESTION_3].map((q, qIndex) => {
            const sel = qIndex === 0 ? situation : qIndex === 1 ? hardestPart : bringsYouHere;
            const tog = qIndex === 0 ? toggleSituation : qIndex === 1 ? toggleHardestPart : toggleBringsYouHere;
            return (
              <View key={qIndex} style={[styles.slide, styles.questionSlide, { width: SCREEN_WIDTH }]}>
                <Pressable
                  onPress={() => (qIndex === 0 ? setPhase('intro') : goToSlide(qIndex - 1))}
                  style={styles.backButton}
                >
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
                    if (qIndex === 2) setOnboardingData({ situation, hardestPart, bringsYouHere });
                    goToSlide(qIndex + 1);
                  }}
                  disabled={sel.length === 0}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Slide 3: YOUR FIRST IMPRESSIONS — Hero + Halo puffy postcards */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
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
                        {
                          transform: [{ rotate: `${rotate}deg` }],
                          backgroundColor: POSTCARD_PASTELS[i],
                          width: wrapperW,
                          height: wrapperH,
                        },
                      ]}
                    >
                      <Image
                        source={src}
                        style={[styles.postcardImage, { width: imgSize, height: imgSize }]}
                        resizeMode="cover"
                      />
                    </View>
                  );
                  if (isHero) {
                    return (
                      <View key={i} style={[styles.heroCardOuter, { top, zIndex }]}>
                        {innerWrapper}
                      </View>
                    );
                  }
                  const wrapperStyle = [
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
                  ];
                  return (
                    <View key={i} style={wrapperStyle}>
                      <Image
                        source={src}
                        style={[styles.postcardImage, { width: imgSize, height: imgSize }]}
                        resizeMode="cover"
                      />
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
            <Text style={styles.slideSubtitle}>
              Send puffy postcards and little moments. Watch them fly to your person.
            </Text>
          </View>

          {/* Slide 4: BRIDGE THE DISTANCE */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
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
            <Text style={styles.slideSubtitle}>
              See where they are, what it's like there, and count down until you're together.
            </Text>
          </View>

          {/* Slide 5: OUR MAGIC + CTAs below */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
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
            <Text style={styles.slideSubtitle}>
              One cozy home screen. Their time, weather, and battery—always in reach.
            </Text>
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
        </ScrollView>

        <Pressable
          style={[styles.tapZone, styles.tapZoneLeft]}
          onPress={handleSlideBack}
        />
        <Pressable
          style={[styles.tapZone, styles.tapZoneRight]}
          onPress={() => goToSlide(slideIndex + 1)}
          disabled={slideIndex === TOTAL_SLIDES - 1}
        />
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
  },
  progressSegmentEmpty: {
    backgroundColor: colors.blush + '60',
  },
  progressSegmentFilled: {
    backgroundColor: colors.blushDark,
  },
  carouselWrap: {
    flex: 1,
    position: 'relative',
  },
  carouselScroll: {
    flex: 1,
  },
  flightPathStreakContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: -1,
  },
  flightPathSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 10,
  },
  tapZoneLeft: { left: 0 },
  tapZoneRight: { right: 0 },
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
