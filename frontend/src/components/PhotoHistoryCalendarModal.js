import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPhotoHistory } from '../lib/api';
import { PolaroidHistoryCard } from './PolaroidStack';
import { colors } from '../theme/colors';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 16;
const CELL = (SCREEN_W - GRID_PAD * 2) / 7;

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function localDateKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ type: 'pad' });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ type: 'day', day: d, key });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ type: 'pad' });
  }
  while (cells.length < 42) {
    cells.push({ type: 'pad' });
  }
  return cells;
}

function mergeDayPhotos(mine, partner, dayKey) {
  const rows = [];
  (mine || []).forEach((p) => {
    if (localDateKey(p.createdAt) === dayKey) {
      rows.push({ ...p, _sender: 'mine' });
    }
  });
  (partner || []).forEach((p) => {
    if (localDateKey(p.createdAt) === dayKey) {
      rows.push({ ...p, _sender: 'partner' });
    }
  });
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rows;
}

/** Smallest calendar year-month among all photos (local device tz), or null if none. */
function earliestPhotoYearMonth(mine, partner) {
  let minYm = null;
  for (const arr of [mine, partner]) {
    for (const p of arr || []) {
      if (!p?.createdAt) continue;
      const d = new Date(p.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const ym = d.getFullYear() * 12 + d.getMonth();
      if (minYm === null || ym < minYm) minYm = ym;
    }
  }
  return minYm;
}

export function PhotoHistoryCalendarModal({
  visible,
  onClose,
  partnerFirstName,
  partnerCity,
  selfFirstName,
  onDeleteMine,
}) {
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState([]);
  const [partner, setPartner] = useState([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [detailKey, setDetailKey] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPhotoHistory();
      setMine(data.mine ?? []);
      setPartner(data.partner ?? []);
    } catch {
      setMine([]);
      setPartner([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    load();
    return undefined;
  }, [visible, load]);

  useEffect(() => {
    if (!visible) {
      setDetailKey(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
  }, [visible]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const now = new Date();
  /** Earliest month users may open: first month with any photo, capped at this month; no photos → this month only. */
  const floorYM = useMemo(() => {
    const n = new Date();
    const cur = n.getFullYear() * 12 + n.getMonth();
    const earliest = earliestPhotoYearMonth(mine, partner);
    if (earliest == null) return cur;
    return Math.min(earliest, cur);
  }, [mine, partner]);
  const cursorYM = year * 12 + monthIndex;
  const canGoPrev = cursorYM > floorYM;
  const canGoNext =
    year < now.getFullYear() || (year === now.getFullYear() && monthIndex < now.getMonth());
  const matrix = useMemo(() => monthMatrix(year, monthIndex), [year, monthIndex]);

  useEffect(() => {
    if (!visible || loading) return;
    if (cursorYM < floorYM) {
      const fy = Math.floor(floorYM / 12);
      const fm = floorYM % 12;
      setCursor(new Date(fy, fm, 1));
    }
  }, [visible, loading, floorYM, cursorYM]);

  const flagsByDay = useMemo(() => {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const map = {};
    const note = (photos, isMine) => {
      for (const p of photos || []) {
        const k = localDateKey(p.createdAt);
        if (!k || !k.startsWith(prefix)) continue;
        if (!map[k]) map[k] = { hasMine: false, hasPartner: false };
        if (isMine) map[k].hasMine = true;
        else map[k].hasPartner = true;
      }
    };
    note(mine, true);
    note(partner, false);
    return map;
  }, [mine, partner, year, monthIndex]);

  const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 1)
  );
  const tKey = todayKey();
  const detailPhotos = detailKey ? mergeDayPhotos(mine, partner, detailKey) : [];
  const selfLabel = selfFirstName?.trim() || 'You';

  const goPrev = () => {
    if (!canGoPrev) return;
    setCursor(new Date(year, monthIndex - 1, 1));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setCursor(new Date(year, monthIndex + 1, 1));
  };

  const handleDelete = (photo) => {
    if (!photo?.id || !onDeleteMine) return;
    Alert.alert(
      'Delete this picture?',
      'Your partner will no longer see it in their widget if it was your latest.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(photo.id);
            try {
              await onDeleteMine(photo.id);
              setMine((prev) => prev.filter((x) => x.id !== photo.id));
            } catch {
              Alert.alert('Could not delete', 'Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {!detailKey ? (
          <>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={onClose}>
                <Ionicons name="close" size={28} color={colors.text} />
              </Pressable>
              <Text style={styles.title}>Photo history</Text>
              <View style={styles.headerRight} />
            </View>

            <View style={styles.monthRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.monthNav,
                  pressed && canGoPrev && styles.pressed,
                  !canGoPrev && styles.monthNavDisabled,
                ]}
                onPress={goPrev}
                disabled={!canGoPrev}
              >
                <Ionicons
                  name="chevron-back"
                  size={26}
                  color={canGoPrev ? colors.blushDark : colors.textMuted}
                />
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.monthNav,
                  pressed && canGoNext && styles.pressed,
                  !canGoNext && styles.monthNavDisabled,
                ]}
                onPress={goNext}
                disabled={!canGoNext}
              >
                <Ionicons
                  name="chevron-forward"
                  size={26}
                  color={canGoNext ? colors.blushDark : colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dotMine]} />
                <Text style={styles.legendText}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dotPartner]} />
                <Text style={styles.legendText}>{partnerFirstName || 'Partner'}</Text>
              </View>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={`w-${i}`} style={[styles.weekday, { width: CELL }]}>
                  {d}
                </Text>
              ))}
            </View>

            {loading ? (
              <View style={styles.centerFill}>
                <ActivityIndicator size="large" color={colors.blushDark} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.gridScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.grid, { paddingHorizontal: GRID_PAD }]}>
                  {matrix.map((cell, idx) => {
                    if (cell.type === 'pad') {
                      return <View key={`p-${idx}`} style={{ width: CELL, height: CELL + 8 }} />;
                    }
                    const f = flagsByDay[cell.key];
                    const isToday = cell.key === tKey;
                    return (
                      <Pressable
                        key={cell.key}
                        style={({ pressed }) => [
                          styles.dayCell,
                          { width: CELL, minHeight: CELL + 8 },
                          isToday && styles.dayToday,
                          pressed && styles.dayPressed,
                        ]}
                        onPress={() => setDetailKey(cell.key)}
                      >
                        <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{cell.day}</Text>
                        <View style={styles.dotsRow}>
                          <View style={[styles.miniDot, f?.hasMine ? styles.dotMine : styles.miniDotEmpty]} />
                          <View style={[styles.miniDot, f?.hasPartner ? styles.dotPartner : styles.miniDotEmpty]} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => setDetailKey(null)}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(`${detailKey}T12:00:00`))}
              </Text>
              <View style={styles.headerRight} />
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {detailPhotos.length === 0 ? (
                <View style={styles.centerFill}>
                  <Ionicons name="images-outline" size={56} color={colors.textMuted} />
                  <Text style={styles.emptyDetail}>No pictures this day</Text>
                </View>
              ) : (
                detailPhotos.map((p, i) => (
                  <View key={p.id || `${p.url}-${i}`} style={styles.detailCardWrap}>
                    <PolaroidHistoryCard
                      photo={p}
                      framePresetIndex={i}
                      isMine={p._sender === 'mine'}
                      partnerFirstName={partnerFirstName}
                      partnerCity={partnerCity}
                      selfLabel={selfLabel}
                    />
                    {p._sender === 'mine' && onDeleteMine ? (
                      <Pressable
                        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                        onPress={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color={colors.white} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.shadow,
  },
  iconBtn: {
    padding: 8,
    minWidth: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  headerRight: {
    minWidth: 44,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  monthNav: {
    padding: 8,
  },
  monthNavDisabled: {
    opacity: 0.35,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotMine: {
    backgroundColor: colors.blushDark,
  },
  dotPartner: {
    backgroundColor: colors.skyDark,
  },
  legendText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  weekday: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  gridScroll: {
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  dayToday: {
    backgroundColor: colors.blush,
    opacity: 1,
  },
  dayPressed: {
    opacity: 0.85,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dayNumToday: {
    color: colors.text,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniDotEmpty: {
    backgroundColor: 'rgba(92, 74, 74, 0.12)',
  },
  centerFill: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  detailScroll: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  detailCardWrap: {
    position: 'relative',
    marginBottom: 28,
  },
  deleteBtn: {
    position: 'absolute',
    top: 12,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDetail: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
