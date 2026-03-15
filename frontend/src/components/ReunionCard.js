import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, glassTextShadow, trayTextShadow, trayTextColor } from '../theme/colors';
import { getCountdown, formatCountdown } from '../utils/countdown';

const RADIUS = 24;

export function ReunionCard({ reunion, saveReunion, endReunion, onSetWidgetPhoto, glass, inTray }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [countdown, setCountdown] = useState(null);

  const hasReunion = reunion?.startDate != null;
  const startDate = hasReunion ? new Date(reunion.startDate) : null;
  const isTogether = startDate != null && startDate.getTime() <= Date.now();

  useEffect(() => {
    if (!startDate) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(getCountdown(startDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [reunion?.startDate]);

  const handleOpenPicker = () => {
    if (startDate) setPickerDate(new Date(startDate));
    else {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      d.setHours(12, 0, 0, 0);
      setPickerDate(d);
    }
    setShowPicker(true);
  };

  const handlePickerConfirm = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    const isSet = event?.type === 'set' || event === 'set';
    if (isSet) {
      const date = selectedDate ?? pickerDate;
      saveReunion(date, null);
      setShowPicker(false);
    } else if (event?.type === 'dismiss') {
      setShowPicker(false);
    }
  };

  const dayOfVisit =
    startDate && isTogether
      ? Math.floor((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : 0;
  const ts = (s) =>
    inTray ? [{ ...s, color: trayTextColor }, trayTextShadow] : glass ? [s, glassTextShadow] : s;
  const iconColor = inTray ? trayTextColor : colors.skyDark;
  const iconColorBlush = inTray ? trayTextColor : colors.blushDark;

  // State 1: Unscheduled
  if (!hasReunion) {
    return (
      <>
        <Card style={[styles.card, styles.cardDefault, inTray && styles.cardTray]} glass={glass || inTray}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar-outline" size={32} color={iconColor} />
          </View>
          <Text style={ts(styles.title)}>Plan next visit</Text>
          <Text style={ts(styles.subtitle)}>Set a date and count down together</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleOpenPicker}
          >
            <Text style={styles.primaryButtonText}>Pick date</Text>
          </Pressable>
        </Card>

        {showPicker && (
          <Modal visible transparent animationType="slide">
            <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>When do you reunite?</Text>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={handlePickerConfirm}
                  style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
                    onPress={() => handlePickerConfirm('set', pickerDate)}
                  >
                    <Text style={styles.confirmButtonText}>Set date</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </Modal>
        )}
      </>
    );
  }

  // State 3: Together mode
  if (isTogether) {
    return (
      <Card style={[styles.card, styles.cardTogether, inTray && styles.cardTray]} glass={glass || inTray}>
        <View style={styles.iconWrapTogether}>
          <Ionicons name="heart" size={28} color={iconColorBlush} />
        </View>
        <Text style={ts(styles.togetherTitle)}>You're Together!</Text>
        <Text style={ts(styles.dayOfVisit)}>Day {dayOfVisit} of visit</Text>
        <Pressable
          style={({ pressed }) => [styles.endButton, pressed && styles.buttonPressed]}
          onPress={() => endReunion()}
        >
          <Text style={ts(styles.endButtonText)}>End Visit</Text>
        </Pressable>
      </Card>
    );
  }

  // State 2: Countdown
  const countdownText = countdown ? formatCountdown(countdown) : '—';

  return (
    <>
      <Card style={[styles.card, styles.cardDefault, inTray && styles.cardTray]} glass={glass || inTray}>
        <View style={styles.countdownRow}>
          <Text style={ts(styles.countdownValue)}>{countdownText}</Text>
          <View style={styles.countdownIcons}>
            {onSetWidgetPhoto && (
              <Pressable
                style={({ pressed }) => [styles.editIconWrap, pressed && styles.buttonPressed]}
                onPress={onSetWidgetPhoto}
                hitSlop={12}
                accessibilityLabel="Set calendar widget photo"
              >
                <Ionicons name="image-outline" size={20} color={inTray ? trayTextColor : colors.textMuted} />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.editIconWrap, pressed && styles.buttonPressed]}
              onPress={handleOpenPicker}
              hitSlop={12}
            >
              <Ionicons name="pencil-outline" size={20} color={inTray ? trayTextColor : colors.textMuted} />
            </Pressable>
          </View>
        </View>
        <Text style={ts(styles.countdownLabel)}>until you're together</Text>
      </Card>

      {showPicker && (
        <Modal visible transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Change reunion date</Text>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handlePickerConfirm}
                style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
              />
              {Platform.OS === 'ios' && (
                <Pressable
                  style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
                  onPress={() => handlePickerConfirm('set', pickerDate)}
                >
                  <Text style={styles.confirmButtonText}>Update</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: RADIUS,
    minHeight: 120,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  cardDefault: {
    backgroundColor: colors.surface,
  },
  cardTogether: {
    backgroundColor: colors.blush + '40',
    borderWidth: 1,
    borderColor: colors.blush + '99',
  },
  cardTray: {
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconWrapTogether: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.skyDark,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  countdownIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdownValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.skyDark,
    letterSpacing: -0.5,
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  editIconWrap: {
    padding: 6,
  },
  togetherTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  dayOfVisit: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 16,
  },
  endButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.blushDark + '99',
  },
  endButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted + '99',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  iosPicker: {
    height: 180,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: colors.skyDark,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
