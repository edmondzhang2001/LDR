import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, AppState, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/useAuthStore';
import { Card } from '../src/components/Card';
import { PartnerStatsCard } from '../src/components/PartnerStatsCard';
import { ReunionCard } from '../src/components/ReunionCard';
import { BackgroundSlideshow } from '../src/components/BackgroundSlideshow';
import { updateLocation, updateBattery, getPresignedPhotoUrl } from '../src/lib/api';
import { colors, glassTextShadow } from '../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const { user, partnerId, partner, fetchPartner, refreshUser, logout, saveReunion, endReunion, addPhotoAfterUpload } = useAuthStore();
  const [myLocation, setMyLocation] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Level 1 sync: when app comes to foreground, silently fetch latest partner + current user data
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchPartner();
        refreshUser();
      }
    });
    return () => subscription.remove();
  }, [fetchPartner, refreshUser]);

  // Guard: no user (e.g. session invalid / DB wiped) → login
  useEffect(() => {
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (partnerId == null) router.replace('/pair');
  }, [user, partnerId, router]);

  // Fetch partner profile when we have partnerId but no partner in store
  useEffect(() => {
    if (user?.partnerId && partner == null) fetchPartner();
  }, [user?.partnerId, partner, fetchPartner]);

  // Request foreground location, reverse-geocode for city, and PUT to backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (cancelled) return;
        const city = address?.city ?? address?.subregion ?? address?.region ?? '';
        await updateLocation({ city, lat: latitude, lng: longitude });
        if (!cancelled) setMyLocation({ lat: latitude, lng: longitude });
      } catch (e) {
        if (!cancelled) setMyLocation(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync battery level on mount and when it changes while app is open
  useEffect(() => {
    let subscription = null;
    const SIMULATOR_MOCK_LEVEL = 0.85;
    const normalizeLevel = (level) => {
      if (typeof level !== 'number' || Number.isNaN(level)) return null;
      if (level < 0) return SIMULATOR_MOCK_LEVEL; // iOS Simulator returns -1
      return Math.max(0, Math.min(1, level));
    };
    const syncBattery = async (level) => {
      const value = normalizeLevel(level);
      if (value == null) return;
      try {
        await updateBattery(value);
      } catch (_) {}
    };
    (async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        await syncBattery(level);
        subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
          syncBattery(batteryLevel);
        });
      } catch (_) {}
    })();
    return () => {
      if (subscription?.remove) subscription.remove();
    };
  }, []);

  const userPhotos = user?.photos ?? [];
  const partnerPhotos = partner?.photos ?? [];
  const slideshowPhotos = [...userPhotos, ...partnerPhotos].filter((p) => p?.url);
  const isImmersiveMode = slideshowPhotos.length > 0;

  const uploadImageUri = async (uri) => {
    setPhotoUploading(true);
    try {
      // 1. Get the pre-signed URL and final URL from our backend
      const { url: presignedUrl, finalUrl } = await getPresignedPhotoUrl();
      if (!presignedUrl || !finalUrl) {
        throw new Error('Backend did not return presigned URL or final URL');
      }

      // 2. Convert the local Expo image URI to a raw Blob
      const imageResponse = await fetch(uri);
      if (!imageResponse.ok) {
        throw new Error('Failed to read local image: ' + imageResponse.status + ' ' + imageResponse.statusText);
      }
      const imageBlob = await imageResponse.blob();
      if (!imageBlob || imageBlob.size === 0) {
        throw new Error('Local image blob is empty');
      }

      // 3. Upload directly to S3
      const s3Response = await fetch(presignedUrl, {
        method: 'PUT',
        body: imageBlob,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (!s3Response.ok) {
        const errText = await s3Response.text().catch(() => s3Response.statusText);
        throw new Error('S3 upload failed: ' + s3Response.status + ' ' + (errText || s3Response.statusText));
      }

      // 4. Save the final URL to our backend / MongoDB
      await addPhotoAfterUpload(finalUrl);
    } catch (e) {
      console.error('[Daily Story upload]', e?.message || e);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleCameraPress = () => {
    Alert.alert(
      'Upload Photo',
      'Take a Picture or Choose from Gallery?',
      [
        {
          text: 'Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.5,
              allowsEditing: false,
            });
            if (result.canceled || !result.assets?.[0]?.uri) return;
            await uploadImageUri(result.assets[0].uri);
          },
        },
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.5,
              allowsEditing: false,
            });
            if (result.canceled || !result.assets?.[0]?.uri) return;
            await uploadImageUri(result.assets[0].uri);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (!user || partnerId == null) return null;

  const partnerName = partner?.name || 'your partner';
  const ts = (s) => (isImmersiveMode ? [s, glassTextShadow] : s);

  return (
    <View style={styles.container}>
      {isImmersiveMode && (
        <BackgroundSlideshow userPhotos={userPhotos} partnerPhotos={partnerPhotos} />
      )}
      <ScrollView
        style={[styles.scrollView, isImmersiveMode && styles.scrollViewImmersive]}
        contentContainerStyle={[styles.scroll, isImmersiveMode && styles.scrollImmersive]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, isImmersiveMode && styles.iconWrapGlass]}>
            <Ionicons name="heart" size={40} color={colors.blushDark} />
          </View>
          <Text style={ts(styles.connectedTitle)}>Connected with {partnerName}</Text>
        </View>

        <View style={styles.cards}>
          <Card style={styles.placeholderCard} glass={isImmersiveMode}>
            <View style={styles.placeholderIconWrap}>
              <Ionicons name="image-outline" size={32} color={colors.blushDark} />
            </View>
            <Text style={ts(styles.placeholderTitle)}>Daily Story</Text>
            <Text style={ts(styles.placeholderSubtitle)}>
              {slideshowPhotos.length > 0 ? 'Your photos are on the background' : 'Take a photo to start'}
            </Text>
          </Card>

          <PartnerStatsCard partner={partner} myLocation={myLocation} glass={isImmersiveMode} />

          <ReunionCard
            reunion={user.reunion}
            saveReunion={saveReunion}
            endReunion={endReunion}
            glass={isImmersiveMode}
          />

          <Pressable style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleCameraPress}
        disabled={photoUploading}
      >
        {photoUploading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="camera" size={28} color={colors.white} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollViewImmersive: { backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 100 },
  scrollImmersive: { backgroundColor: 'transparent' },
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
  iconWrapGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 28,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  signOutButtonPressed: {
    opacity: 0.85,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blushDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.9,
  },
});
