import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors } from '../theme/colors';
import { fetchWeatherAt, weatherIconToIonicons } from '../utils/weather';
import { calculateDistance } from '../utils/distance';

const RADIUS = 24;

export function PartnerStatsCard({ partner, myLocation }) {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

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

  return (
    <Card style={styles.card}>
      {/* Top: Partner's city with location pin */}
      <View style={styles.row}>
        <Ionicons name="location" size={20} color={colors.blushDark} />
        <Text style={styles.city} numberOfLines={1}>
          {cityName}
        </Text>
      </View>

      {/* Middle: Temperature and weather description */}
      <View style={styles.weatherBlock}>
        {isLoading ? (
          <View style={styles.skeletonRow}>
            <ActivityIndicator size="small" color={colors.skyDark} />
            <Text style={styles.skeletonText}>Loading weather…</Text>
          </View>
        ) : weather ? (
          <>
            <View style={styles.tempRow}>
              <Ionicons name={weatherIcon} size={36} color={colors.skyDark} />
              <Text style={styles.temp}>{weather.tempFormatted}</Text>
            </View>
            <Text style={styles.description} numberOfLines={1}>
              {weather.description}
            </Text>
          </>
        ) : hasPartnerCoords ? (
          <Text style={styles.noWeather}>Weather unavailable</Text>
        ) : (
          <Text style={styles.noWeather}>Partner hasn’t shared location</Text>
        )}
      </View>

      {/* Bottom: Distance pill */}
      <View style={styles.pillWrap}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
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
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
