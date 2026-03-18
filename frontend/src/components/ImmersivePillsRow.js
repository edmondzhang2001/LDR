import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassPill } from './GlassPill';
import { colors } from '../theme/colors';
import { fetchWeatherAt, weatherIconToIonicons } from '../utils/weather';
import { getCountdown, formatCountdown, getDayDifferenceFromToday } from '../utils/countdown';

const PILL_TEXT = { fontSize: 13, fontWeight: '600', color: colors.text };

export function ImmersivePillsRow({ partner, myLocation, reunion }) {
  const [weather, setWeather] = useState(null);

  const partnerLoc = partner?.location;
  const hasPartnerCoords = partnerLoc && typeof partnerLoc.lat === 'number' && typeof partnerLoc.lng === 'number';

  useEffect(() => {
    if (!hasPartnerCoords) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    fetchWeatherAt(partnerLoc.lat, partnerLoc.lng).then((data) => {
      if (!cancelled) setWeather(data);
    });
    return () => { cancelled = true; };
  }, [partnerLoc?.lat, partnerLoc?.lng]);

  const cityName = partnerLoc?.city?.trim() || '—';
  const weatherIcon = weather?.icon ? weatherIconToIonicons(weather.icon) : 'partly-sunny-outline';
  const tempText = weather?.tempFormatted ?? '—';

  const rawBattery = partner?.batteryLevel;
  const hasValidBattery =
    typeof rawBattery === 'number' && !Number.isNaN(rawBattery) && rawBattery >= 0 && rawBattery <= 1;
  const batteryPct = hasValidBattery ? Math.round(rawBattery * 100) : null;
  const batteryIcon =
    batteryPct == null ? 'battery-outline' : batteryPct >= 80 ? 'battery-full' : batteryPct >= 20 ? 'battery-half' : 'battery-dead';
  const batteryColor =
    batteryPct == null ? colors.textMuted : batteryPct >= 80 ? colors.success : batteryPct >= 20 ? colors.text : colors.blushDark;

  const hasReunion = reunion?.startDate != null;
  const startDate = hasReunion ? new Date(reunion.startDate) : null;
  const daysUntilReunion = startDate ? getDayDifferenceFromToday(startDate) : null;
  const isTogether = startDate != null && daysUntilReunion != null && daysUntilReunion <= 0;
  const countdown = startDate && !isTogether ? getCountdown(startDate) : null;
  const reunionLabel = isTogether ? 'Together!' : countdown ? formatCountdown(countdown) : '—';

  return (
    <View style={styles.row}>
      <GlassPill>
        <Ionicons name="location" size={16} color={colors.blushDark} />
        <Text style={PILL_TEXT} numberOfLines={1}>{cityName}</Text>
      </GlassPill>
      <GlassPill>
        <Ionicons name={weatherIcon} size={16} color={colors.skyDark} />
        <Text style={PILL_TEXT}>{tempText}</Text>
      </GlassPill>
      <GlassPill>
        <Ionicons name={batteryIcon} size={16} color={batteryColor} />
        <Text style={PILL_TEXT}>{batteryPct != null ? `${batteryPct}%` : '—'}</Text>
      </GlassPill>
      <GlassPill>
        <Ionicons name="heart" size={16} color={colors.blushDark} />
        <Text style={PILL_TEXT}>{reunionLabel}</Text>
      </GlassPill>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
});
