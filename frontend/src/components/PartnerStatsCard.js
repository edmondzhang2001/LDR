import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, glassTextShadow, trayTextShadow, trayTextColor } from '../theme/colors';
import { fetchWeatherAt, weatherIconToIonicons } from '../utils/weather';
import { calculateDistance } from '../utils/distance';
import { formatRelativeTime } from '../utils/relativeTime';

const RADIUS = 24;

export function PartnerStatsCard({ partner, myLocation, glass, inTray }) {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!partner?.lastUpdatedDataAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [partner?.lastUpdatedDataAt]);

  const partnerLoc = partner?.location;
  const hasPartnerCoords = partnerLoc && typeof partnerLoc.lat === 'number' && typeof partnerLoc.lng === 'number';
  const hasMyCoords = myLocation && typeof myLocation.lat === 'number' && typeof myLocation.lng === 'number';
  const distanceKm =
    hasPartnerCoords && hasMyCoords
      ? Math.round(calculateDistance(myLocation.lat, myLocation.lng, partnerLoc.lat, partnerLoc.lng))
      : null;

  useEffect(() => {
    if (!hasPartnerCoords) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    fetchWeatherAt(partnerLoc.lat, partnerLoc.lng)
      .then((data) => {
        if (!cancelled) {
          setWeather(data);
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => { cancelled = true; };
  }, [partnerLoc?.lat, partnerLoc?.lng]);

  const cityName = partnerLoc?.city?.trim() || '—';
  const isLoading = weatherLoading && !weather;
  const weatherIcon = weather?.icon ? weatherIconToIonicons(weather.icon) : 'partly-sunny-outline';

  const rawBattery = partner?.batteryLevel;
  const lastUpdated = partner?.lastUpdatedDataAt;
  const hasValidBattery =
    typeof rawBattery === 'number' &&
    !Number.isNaN(rawBattery) &&
    rawBattery >= 0 &&
    rawBattery <= 1;
  const batteryPct = hasValidBattery ? Math.round(rawBattery * 100) : null;
  const showBatteryRow = hasValidBattery;
  const batteryIcon =
    batteryPct == null
      ? 'battery-outline'
      : batteryPct >= 80
        ? 'battery-full'
        : batteryPct >= 20
          ? 'battery-half'
          : 'battery-dead';
  const batteryColor =
    batteryPct == null
      ? colors.textMuted
      : batteryPct >= 80
        ? colors.success
        : batteryPct >= 20
          ? colors.text
          : colors.blushDark;
  const relativeTime = lastUpdated ? formatRelativeTime(lastUpdated) : '';
  const ts = (s) =>
    inTray ? [{ ...s, color: trayTextColor }, trayTextShadow] : glass ? [s, glassTextShadow] : s;
  const iconColor = inTray ? trayTextColor : colors.blushDark;
  const cardStyle = inTray ? [styles.card, styles.cardTray] : styles.card;

  return (
    <Card style={cardStyle} glass={glass || inTray}>
      <View style={styles.row}>
        <Ionicons name="location" size={20} color={iconColor} />
        <Text style={ts(styles.city)} numberOfLines={1}>
          {cityName}
        </Text>
      </View>

      {/* Battery: icon + percentage + "Updated X ago" — only when we have valid data */}
      {showBatteryRow ? (
        <View style={styles.batteryRow}>
          <Ionicons name={batteryIcon} size={22} color={inTray ? trayTextColor : batteryColor} />
          <Text style={ts(styles.batteryPct)}>
            {batteryPct != null ? `${batteryPct}%` : '—'}
          </Text>
          {relativeTime ? (
            <Text style={ts(styles.batteryUpdated)}>Updated {relativeTime}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Middle: Temperature and weather description */}
      <View style={styles.weatherBlock}>
        {isLoading ? (
          <View style={styles.skeletonRow}>
            <ActivityIndicator size="small" color={inTray ? trayTextColor : colors.skyDark} />
            <Text style={ts(styles.skeletonText)}>Loading weather…</Text>
          </View>
        ) : weather ? (
          <>
            <View style={styles.tempRow}>
              <Ionicons name={weatherIcon} size={36} color={inTray ? trayTextColor : colors.skyDark} />
              <Text style={ts(styles.temp)}>{weather.tempFormatted}</Text>
            </View>
            <Text style={ts(styles.description)} numberOfLines={1}>
              {weather.description}
            </Text>
          </>
        ) : hasPartnerCoords ? (
          <Text style={ts(styles.noWeather)}>Weather unavailable</Text>
        ) : (
          <Text style={ts(styles.noWeather)}>Partner hasn’t shared location</Text>
        )}
      </View>

      {/* Bottom: Distance pill */}
      <View style={styles.pillWrap}>
        <View style={[styles.pill, inTray && styles.pillTray]}>
          <Text style={ts(styles.pillText)}>
            📍 {distanceKm != null ? `${distanceKm} km away` : '— km away'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: RADIUS,
    backgroundColor: colors.surface,
  },
  cardTray: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  city: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  batteryPct: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  batteryUpdated: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  weatherBlock: {
    marginBottom: 16,
    minHeight: 52,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  temp: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  noWeather: {
    fontSize: 15,
    color: colors.textMuted,
  },
  pillWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.blush + '80',
  },
  pillTray: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
