import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { Card } from '../src/components/Card';
import { colors } from '../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const { user, partnerId, partner, fetchPartner } = useAuthStore();

  // Guard: unpaired users cannot see the dashboard
  useEffect(() => {
    if (user && partnerId == null) router.replace('/pair');
  }, [user, partnerId, router]);

  // Fetch partner profile when we have partnerId but no partner in store
  useEffect(() => {
    if (user?.partnerId && partner == null) fetchPartner();
  }, [user?.partnerId, partner, fetchPartner]);

  if (!user || partnerId == null) return null;

  const partnerName = partner?.name || 'your partner';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart" size={40} color={colors.blushDark} />
        </View>
        <Text style={styles.connectedTitle}>Connected with {partnerName}</Text>
      </View>

      <View style={styles.cards}>
        <Card style={styles.placeholderCard}>
          <View style={styles.placeholderIconWrap}>
            <Ionicons name="image-outline" size={32} color={colors.blushDark} />
          </View>
          <Text style={styles.placeholderTitle}>Recent Photo</Text>
          <Text style={styles.placeholderSubtitle}>Latest from your partner — coming soon</Text>
        </Card>
        
        <Card style={styles.placeholderCard}>
          <View style={styles.placeholderIconWrap}>
            <Ionicons name="partly-sunny-outline" size={32} color={colors.skyDark} />
          </View>
          <Text style={styles.placeholderTitle}>Partner Stats</Text>
          <Text style={styles.placeholderSubtitle}>Weather, battery & location — coming soon</Text>
        </Card>

        <Card style={styles.placeholderCard}>
          <View style={styles.placeholderIconWrap}>
            <Ionicons name="calendar-outline" size={32} color={colors.skyDark} />
          </View>
          <Text style={styles.placeholderTitle}>Reunion Countdown</Text>
          <Text style={styles.placeholderSubtitle}>Next reunion date — coming soon</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  connectedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  partnerId: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cards: { gap: 20 },
  placeholderCard: {
    minHeight: 120,
    justifyContent: 'center',
  },
  placeholderIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
