import { useRef, useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/** Show widget coach for accounts created within this window (first-time sign-up / sign-in cohort). */
export const WIDGET_COACH_NEW_ACCOUNT_MAX_MS = 14 * 24 * 60 * 60 * 1000;

const STEPS = [
  {
    title: 'Open the widget gallery',
    body: 'Touch and hold an empty area on your Home Screen until the apps jiggle, then tap + in the corner.',
  },
  {
    title: 'Find Duva',
    body: 'Search for Duva and add the widgets you want — partner photo, countdown, and live stats.',
  },
  {
    title: 'Stay in sync',
    body: 'Open Duva now and then so widgets stay fresh with photos, mood, and your reunion date.',
  },
];

/** Decorative visuals per step (icons + shapes, no image assets). */
function StepIllustration({ index }) {
  if (index === 0) {
    return (
      <View style={styles.illustration}>
        <View style={styles.homeGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.homeAppTile,
                i === 2 && styles.homeAppTileHighlight,
              ]}
            />
          ))}
        </View>
        <View style={styles.fingerHint}>
          <Ionicons name="hand-left-outline" size={36} color={colors.blushDark} />
        </View>
        <View style={styles.plusBadge}>
          <Ionicons name="add" size={28} color={colors.white} />
        </View>
        <Text style={styles.illustrationCaption}>Home Screen → +</Text>
      </View>
    );
  }

  if (index === 1) {
    return (
      <View style={styles.illustration}>
        <View style={styles.searchBarMock}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={styles.searchBarText}>Duva</Text>
        </View>
        <View style={styles.widgetRow}>
          <View style={[styles.widgetMini, styles.widgetMiniPhoto]}>
            <Ionicons name="image" size={26} color={colors.blushDark} />
            <Text style={styles.widgetMiniLabel}>Photo</Text>
          </View>
          <View style={[styles.widgetMini, styles.widgetMiniCal]}>
            <Ionicons name="calendar" size={26} color={colors.skyDark} />
            <Text style={styles.widgetMiniLabel}>Countdown</Text>
          </View>
          <View style={[styles.widgetMini, styles.widgetMiniStats]}>
            <Ionicons name="pulse" size={26} color={colors.blushDark} />
            <Text style={styles.widgetMiniLabel}>Stats</Text>
          </View>
        </View>
        <Text style={styles.illustrationCaption}>Pick one or all three</Text>
      </View>
    );
  }

  return (
    <View style={styles.illustration}>
      <View style={styles.syncOrbit}>
        <View style={styles.syncCenter}>
          <Ionicons name="heart" size={40} color={colors.blushDark} />
        </View>
        <View style={[styles.syncSatellite, styles.syncSat1]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.skyDark} />
        </View>
        <View style={[styles.syncSatellite, styles.syncSat2]}>
          <Ionicons name="refresh" size={22} color={colors.blushDark} />
        </View>
        <View style={[styles.syncSatellite, styles.syncSat3]}>
          <Ionicons name="cloud-done-outline" size={22} color={colors.textMuted} />
        </View>
      </View>
      <Text style={styles.illustrationCaption}>App & widgets stay connected</Text>
    </View>
  );
}

export function WidgetSetupCoachModal({ visible, onDismiss }) {
  const scrollRef = useRef(null);
  const [slideWidth, setSlideWidth] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);

  const lastIndex = STEPS.length - 1;

  const goToSlide = useCallback(
    (index) => {
      const i = Math.max(0, Math.min(lastIndex, index));
      setSlideIndex(i);
      if (slideWidth > 0) {
        scrollRef.current?.scrollTo({ x: i * slideWidth, animated: true });
      }
    },
    [slideWidth, lastIndex]
  );

  useEffect(() => {
    if (!visible) return;
    setSlideIndex(0);
    const t = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
    return () => cancelAnimationFrame(t);
  }, [visible]);

  const onScrollEnd = useCallback(
    (e) => {
      if (slideWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      setSlideIndex(Math.round(x / slideWidth));
    },
    [slideWidth]
  );

  const onCarouselLayout = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setSlideWidth(w);
  }, []);

  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.kicker}>Home Screen widgets</Text>
          <Text style={styles.headline}>Add Duva at a glance</Text>

          <View style={styles.carouselWrap} onLayout={onCarouselLayout}>
            {slideWidth > 0 ? (
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                keyboardShouldPersistTaps="handled"
                onMomentumScrollEnd={onScrollEnd}
                scrollEventThrottle={16}
              >
                {STEPS.map((step, i) => (
                  <View style={[styles.slidePage, { width: slideWidth }]} key={String(i)}>
                    <StepIllustration index={i} />
                    <Text style={styles.slideTitle}>{step.title}</Text>
                    <Text style={styles.slideBody}>{step.body}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.slideMeasurePlaceholder} />
            )}
          </View>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <Pressable
                key={String(i)}
                onPress={() => goToSlide(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Go to step ${i + 1}`}
              >
                <View style={[styles.dot, i === slideIndex && styles.dotActive]} />
              </Pressable>
            ))}
          </View>

          <View style={styles.navRow}>
            {slideIndex > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.textBtn, pressed && styles.textBtnPressed]}
                onPress={() => goToSlide(slideIndex - 1)}
              >
                <Ionicons name="chevron-back" size={20} color={colors.skyDark} />
                <Text style={styles.textBtnLabel}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}

            {slideIndex < lastIndex ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  slideWidth <= 0 && styles.primaryBtnDisabled,
                  pressed && styles.primaryBtnPressed,
                ]}
                onPress={() => goToSlide(slideIndex + 1)}
                disabled={slideWidth <= 0}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} style={styles.primaryBtnIcon} />
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  slideWidth <= 0 && styles.primaryBtnDisabled,
                  pressed && styles.primaryBtnPressed,
                ]}
                onPress={onDismiss}
                disabled={slideWidth <= 0}
              >
                <Text style={styles.primaryBtnText}>Got it</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TILE = 44;
const GAP = 8;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  carouselWrap: {
    width: '100%',
    minHeight: 340,
  },
  slideMeasurePlaceholder: {
    minHeight: 340,
  },
  slidePage: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  illustration: {
    height: 200,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: TILE * 3 + GAP * 2,
    gap: GAP,
    justifyContent: 'center',
  },
  homeAppTile: {
    width: TILE,
    height: TILE,
    borderRadius: 12,
    backgroundColor: colors.blush + '55',
    borderWidth: 1,
    borderColor: colors.blush + '99',
  },
  homeAppTileHighlight: {
    backgroundColor: colors.blush,
    borderColor: colors.blushDark,
  },
  fingerHint: {
    position: 'absolute',
    bottom: 36,
    right: '18%',
    opacity: 0.9,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 28,
    left: '12%',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.blushDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  illustrationCaption: {
    position: 'absolute',
    bottom: 0,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  searchBarMock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.blush + '40',
    marginBottom: 20,
  },
  searchBarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  widgetRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  widgetMini: {
    width: 92,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  widgetMiniPhoto: {
    backgroundColor: colors.blush + '35',
    borderColor: colors.blushDark,
  },
  widgetMiniCal: {
    backgroundColor: '#B8E3D4' + '99',
    borderColor: colors.skyDark,
  },
  widgetMiniStats: {
    backgroundColor: '#D4C5F9' + '99',
    borderColor: colors.blushDark,
  },
  widgetMiniLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  syncOrbit: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncCenter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.blush + '50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.blushDark,
  },
  syncSatellite: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.blush + '60',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  syncSat1: { top: 8, right: 24 },
  syncSat2: { bottom: 16, left: 12 },
  syncSat3: { top: 36, left: 4 },
  slideTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  slideBody: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blush + '80',
  },
  dotActive: {
    width: 22,
    borderRadius: 4,
    backgroundColor: colors.blushDark,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navSpacer: {
    minWidth: 88,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  textBtnPressed: {
    opacity: 0.7,
  },
  textBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.skyDark,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blushDark,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 132,
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  primaryBtnIcon: {
    marginLeft: 4,
  },
});
