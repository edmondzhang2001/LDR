import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, AppState, ActivityIndicator, Alert, Modal, TextInput, Image, RefreshControl, KeyboardAvoidingView, Platform, ActionSheetIOS } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, syncCalendarWidgetPhoto } from '../src/store/useAuthStore';
import { Card } from '../src/components/Card';
import { ReunionCard } from '../src/components/ReunionCard';
import { PostcardStack } from '../src/components/PostcardStack';
import { PolaroidStack } from '../src/components/PolaroidStack';
import { MoodEditorModal } from '../src/components/MoodEditorModal';
import { DoveCarryOverlay } from '../src/components/DoveCarryOverlay';
import { TodaysPhotosModal } from '../src/components/TodaysPhotosModal';
import { CustomCamera } from '../src/components/CustomCamera';
import { updateLocation, updateBattery, getPresignedPhotoUrl } from '../src/lib/api';
import { colors } from '../src/theme/colors';
import { fetchWeatherAt, weatherIconToIonicons } from '../src/utils/weather';
import { formatRelativeTime } from '../src/utils/relativeTime';
import { usePartnerTime } from '../src/hooks/usePartnerTime';
import { calculateDistance } from '../src/utils/distance';

export default function HomeScreen() {
  const router = useRouter();
  const { user, partnerId, partner, fetchPartner, refreshUser, saveReunion, endReunion, addPhotoAfterUpload, updateMood, isAnimatingSend, isSendingPhoto, setAnimatingSend, setSendingPhoto, todaysPhotos, fetchTodaysPhotos, deletePhotoFromToday } = useAuthStore();
  const [myLocation, setMyLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [uploadPreviewUri, setUploadPreviewUri] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [widgetPhotoPreviewUri, setWidgetPhotoPreviewUri] = useState(null);
  const [widgetPhotoSyncing, setWidgetPhotoSyncing] = useState(false);
  const CAPTION_MAX = 60;

  const handleOpenHistory = () => {
    setHistoryModalVisible(true);
  };

  const handleOpenWidgetPhotoPicker = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    try {
      const { uri } = await manipulateAsync(result.assets[0].uri, [], {
        format: SaveFormat.JPEG,
        compress: 0.85,
      });
      setWidgetPhotoPreviewUri(uri);
    } catch (e) {
      setWidgetPhotoPreviewUri(result.assets[0].uri);
    }
  }, []);

  const handleConfirmWidgetPhoto = useCallback(async () => {
    if (!widgetPhotoPreviewUri || Platform.OS !== 'ios') return;
    setWidgetPhotoSyncing(true);
    try {
      const ok = await syncCalendarWidgetPhoto(widgetPhotoPreviewUri);
      setWidgetPhotoPreviewUri(null);
      if (ok) {
        Alert.alert('Done', 'Your countdown widget background has been updated.');
      } else {
        Alert.alert('Something went wrong', 'Could not update the widget. Please try again.');
      }
    } finally {
      setWidgetPhotoSyncing(false);
    }
  }, [widgetPhotoPreviewUri]);

  const handleSetCalendarWidgetPhoto = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Set background photo', 'Remove background'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) handleOpenWidgetPhotoPicker();
        if (buttonIndex === 2) {
          syncCalendarWidgetPhoto(null);
          Alert.alert('Done', 'Widget background removed.');
        }
      }
    );
  }, [handleOpenWidgetPhotoPicker]);

  const handleFetchTodaysPhotos = useCallback(async () => {
    setHistoryLoading(true);
    try {
      await fetchTodaysPhotos();
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchTodaysPhotos]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshUser(), fetchPartner()]);
    } finally {
      setRefreshing(false);
    }
  };

  const partnerTime = usePartnerTime(partner?.timezone);

  const partnerLoc = partner?.location;
  const hasPartnerCoords =
    partnerLoc && typeof partnerLoc.lat === 'number' && typeof partnerLoc.lng === 'number';

  useEffect(() => {
    if (!hasPartnerCoords) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    fetchWeatherAt(partnerLoc.lat, partnerLoc.lng)
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => { cancelled = true; };
  }, [partnerLoc?.lat, partnerLoc?.lng]);

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

  /** Performs S3 upload + backend save. Returns true on success, false on failure. Does not clear modal state. */
  const performUpload = async (uri, caption = '') => {
    setSendingPhoto(true);
    try {
      const { url: presignedUrl, finalUrl } = await getPresignedPhotoUrl();
      if (!presignedUrl || !finalUrl) throw new Error('Backend did not return presigned URL or final URL');

      const imageResponse = await fetch(uri);
      if (!imageResponse.ok) throw new Error('Failed to read local image');
      const imageBlob = await imageResponse.blob();
      if (!imageBlob || imageBlob.size === 0) throw new Error('Local image blob is empty');

      const s3Response = await fetch(presignedUrl, {
        method: 'PUT',
        body: imageBlob,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      if (!s3Response.ok) {
        const errText = await s3Response.text().catch(() => s3Response.statusText);
        throw new Error('S3 upload failed: ' + (errText || s3Response.statusText));
      }

      await addPhotoAfterUpload(finalUrl, caption);
      return true;
    } catch (e) {
      console.error('[Daily Story upload]', e?.message || e);
      return false;
    } finally {
      setSendingPhoto(false);
    }
  };

  const handleSendPhoto = () => {
    if (!uploadPreviewUri) return;
    setAnimatingSend(true);
  };

  const handleDoveOverlayDone = () => {
    setAnimatingSend(false);
    setSendingPhoto(false);
    setUploadPreviewUri(null);
    setUploadCaption('');
  };

  const openUploadWithPreview = (uri) => {
    setUploadPreviewUri(uri);
    setUploadCaption('');
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
            try {
              const { uri } = await manipulateAsync(result.assets[0].uri, [], {
                format: SaveFormat.JPEG,
                compress: 0.85,
              });
              openUploadWithPreview(uri);
            } catch (e) {
              openUploadWithPreview(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Camera',
          onPress: () => setShowCustomCamera(true),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (!user || partnerId == null) return null;

  const partnerDisplayName =
    [partner?.firstName, partner?.lastName].filter(Boolean).join(' ') || partner?.name || 'your partner';
  const partnerFirstNameValue =
    partner?.firstName || partner?.name?.trim().split(/\s+/)[0] || '';
  const partnerName = partnerDisplayName;
  const cityName = partnerLoc?.city?.trim() || '—';
  const weatherIcon = weather?.icon ? weatherIconToIonicons(weather.icon) : 'partly-sunny-outline';
  const rawBattery = partner?.batteryLevel;
  const hasValidBattery =
    typeof rawBattery === 'number' && !Number.isNaN(rawBattery) && rawBattery >= 0 && rawBattery <= 1;
  const batteryPct = hasValidBattery ? Math.round(rawBattery * 100) : null;
  const batteryIcon =
    batteryPct == null
      ? 'battery-outline'
      : batteryPct >= 80
        ? 'battery-full'
        : batteryPct >= 20
          ? 'battery-half'
          : 'battery-dead';
  const batteryColor =
    batteryPct == null ? colors.textMuted : batteryPct >= 80 ? colors.success : batteryPct >= 20 ? colors.text : colors.blushDark;
  const lastUpdated = partner?.lastUpdatedDataAt;
  const relativeTime = lastUpdated ? formatRelativeTime(lastUpdated) : '';
  const partnerFirstName = (partnerFirstNameValue || 'PARTNER').toUpperCase();
  const distanceKm =
    myLocation && hasPartnerCoords
      ? Math.round(calculateDistance(myLocation.lat, myLocation.lng, partnerLoc.lat, partnerLoc.lng))
      : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.blushDark}
            colors={[colors.blushDark]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="heart" size={40} color={colors.blushDark} />
            </View>
            <Pressable
              style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
              onPress={() => router.push('/settings')}
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={26} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.connectedTitle}>Connected with {partnerName}</Text>
          {/* Mood pills: partner (read-only, anchored) + me (editable with affordance) */}
          <View style={styles.moodRow}>
            <View style={styles.moodColumn}>
              <Text style={styles.moodColumnLabel}>{partnerFirstName}</Text>
              <View style={styles.moodPillPartner}>
                {partner?.mood?.emoji != null || partner?.mood?.text ? (
                  <>
                    <Text style={styles.moodEmoji}>{partner.mood?.emoji ?? '💭'}</Text>
                    <Text style={styles.moodText} numberOfLines={1}>{partner.mood?.text || 'Status'}</Text>
                  </>
                ) : (
                  <Text style={styles.moodPlaceholder}>—</Text>
                )}
              </View>
            </View>
            <View style={styles.moodColumn}>
              <Text style={styles.moodColumnLabel}>ME</Text>
              <Pressable
                style={({ pressed }) => [styles.moodPillSelf, pressed && styles.moodPillPressed]}
                onPress={() => setMoodModalVisible(true)}
              >
                {user?.mood?.emoji != null || user?.mood?.text ? (
                  <>
                    <Text style={styles.moodEmoji}>{user.mood?.emoji ?? '💭'}</Text>
                    <Text style={styles.moodText} numberOfLines={1}>{user.mood?.text || 'Status'}</Text>
                  </>
                ) : (
                  <Text style={styles.moodSetStatus}>+ Set Status</Text>
                )}
                <Ionicons name="pencil" size={12} color={colors.textMuted} style={styles.moodPencilIcon} />
              </Pressable>
            </View>
          </View>
        </View>

        <PolaroidStack partnerPhotos={partnerPhotos} partnerCity={cityName} partnerFirstName={partnerFirstNameValue} />

        <View style={styles.cards}>
          {/* Row 1: Location (left) + Weather (right) */}
          <View style={styles.statsRow}>
            <Card style={styles.halfCard}>
              <Ionicons name="location" size={22} color={colors.blushDark} />
              <Text style={styles.halfCardTitle}>Location</Text>
              <Text style={styles.halfCardValue} numberOfLines={1}>{cityName}</Text>
              {partnerTime ? (
                <View style={styles.partnerTimeRow}>
                  <Ionicons name="time-outline" size={18} color={colors.blushDark} />
                  <Text style={styles.partnerTimeText}>{partnerTime}</Text>
                </View>
              ) : null}
            </Card>
            <Card style={styles.halfCard}>
              <Ionicons name={weatherIcon} size={22} color={colors.skyDark} />
              <Text style={styles.halfCardTitle}>Weather</Text>
              {weatherLoading && !weather ? (
                <ActivityIndicator size="small" color={colors.skyDark} style={styles.weatherLoader} />
              ) : (
                <Text style={styles.halfCardValue}>{weather ? weather.tempFormatted : '—'}</Text>
              )}
            </Card>
          </View>

          

          {/* Row 2b: Distance apart */}
          <Card style={styles.distanceCard}>
            <Ionicons name="navigate" size={22} color={colors.blushDark} />
            <Text style={styles.halfCardTitle}>Distance apart</Text>
            <Text style={styles.distanceValue}>
              {distanceKm != null ? `${distanceKm} km` : '—'}
            </Text>
          </Card>

          <Card style={styles.batteryCard}>
            <View style={styles.batteryRow}>
              <Ionicons name={batteryIcon} size={24} color={batteryColor} />
              <Text style={styles.batteryPct}>{batteryPct != null ? `${batteryPct}%` : '—'}</Text>
              {relativeTime ? (
                <Text style={styles.batteryUpdated}>Updated {relativeTime}</Text>
              ) : null}
            </View>
            <Text style={styles.batteryLabel}>Partner's battery</Text>
          </Card>

          {/* Row 3: Reunion (editable) */}
          <ReunionCard
            reunion={user.reunion}
            saveReunion={saveReunion}
            endReunion={endReunion}
            onSetWidgetPhoto={Platform.OS === 'ios' ? handleSetCalendarWidgetPhoto : undefined}
          />
        </View>
      </ScrollView>

      <MoodEditorModal
        visible={moodModalVisible}
        currentMood={user?.mood}
        onSave={(emoji, text) => updateMood(emoji ?? '', text ?? '')}
        onClose={() => setMoodModalVisible(false)}
      />

      <Modal visible={!!widgetPhotoPreviewUri} transparent animationType="slide">
        <Pressable style={styles.uploadModalBackdrop} onPress={() => setWidgetPhotoPreviewUri(null)}>
          <View style={[styles.uploadModalSheet, styles.widgetPhotoSheet]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.uploadModalTitle}>Widget background</Text>
            <Text style={styles.widgetPhotoSubtitle}>This photo will appear blurred behind your countdown</Text>
            <Image source={{ uri: widgetPhotoPreviewUri }} style={styles.uploadPreviewImage} resizeMode="cover" />
            <Pressable
              style={({ pressed }) => [styles.widgetPhotoChooseAnother, pressed && styles.uploadButtonPressed]}
              onPress={handleOpenWidgetPhotoPicker}
            >
              <Ionicons name="images-outline" size={16} color={colors.skyDark} />
              <Text style={styles.widgetPhotoChooseAnotherText}>Choose another</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.widgetPhotoRemoveBg, pressed && styles.uploadButtonPressed]}
              onPress={async () => {
                setWidgetPhotoPreviewUri(null);
                await syncCalendarWidgetPhoto(null);
                Alert.alert('Done', 'Widget background removed.');
              }}
            >
              <Ionicons name="image-outline" size={16} color={colors.textMuted} />
              <Text style={styles.widgetPhotoRemoveBgText}>Remove background</Text>
            </Pressable>
            <View style={styles.uploadModalButtons}>
              <Pressable
                style={({ pressed }) => [styles.uploadCancelButton, pressed && styles.uploadButtonPressed]}
                onPress={() => setWidgetPhotoPreviewUri(null)}
              >
                <Text style={styles.uploadCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.uploadConfirmButton, pressed && styles.uploadButtonPressed]}
                onPress={handleConfirmWidgetPhoto}
                disabled={widgetPhotoSyncing}
              >
                {widgetPhotoSyncing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.uploadConfirmText}>Use for widget</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!uploadPreviewUri && !isAnimatingSend} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.uploadModalBackdrop}>
            <View style={styles.uploadModalSheet}>
              <Text style={styles.uploadModalTitle}>Add to Daily Story</Text>
              <Image source={{ uri: uploadPreviewUri }} style={styles.uploadPreviewImage} resizeMode="cover" />
              <Text style={styles.uploadCaptionLabel}>Caption (optional)</Text>
              <TextInput
                style={styles.uploadCaptionInput}
                placeholder="Say something about this photo..."
                placeholderTextColor={colors.textMuted}
                value={uploadCaption}
                onChangeText={(t) => setUploadCaption(t.slice(0, CAPTION_MAX))}
                maxLength={CAPTION_MAX}
              />
              <Text style={styles.uploadCharCount}>{uploadCaption.length}/{CAPTION_MAX}</Text>
              <View style={styles.uploadModalButtons}>
                <Pressable
                  style={({ pressed }) => [styles.uploadCancelButton, pressed && styles.uploadButtonPressed]}
                  onPress={() => { setUploadPreviewUri(null); setUploadCaption(''); }}
                >
                  <Text style={styles.uploadCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.uploadConfirmButton, pressed && styles.uploadButtonPressed]}
                  onPress={handleSendPhoto}
                  disabled={isAnimatingSend || isSendingPhoto}
                >
                  <Text style={styles.uploadConfirmText}>Send</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DoveCarryOverlay
        visible={isAnimatingSend || isSendingPhoto}
        imageUri={uploadPreviewUri}
        caption={uploadCaption}
        stampText={uploadCaption?.trim() ? `"${uploadCaption.trim()}"` : ''}
        onUploadRequest={() => performUpload(uploadPreviewUri, uploadCaption)}
        onDone={handleDoveOverlayDone}
      />

      <Modal visible={showCustomCamera} animationType="slide" statusBarTranslucent>
        <CustomCamera
          onClose={() => setShowCustomCamera(false)}
          onPhotoCaptured={(uri) => {
            openUploadWithPreview(uri);
            setShowCustomCamera(false);
          }}
        />
      </Modal>

      <Pressable
        style={({ pressed }) => [styles.historyButton, pressed && styles.fabPressed]}
        onPress={handleOpenHistory}
      >
        <Ionicons name="time-outline" size={26} color={colors.white} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleCameraPress}
        disabled={isAnimatingSend || isSendingPhoto}
      >
        {(isAnimatingSend || isSendingPhoto) ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="camera" size={28} color={colors.white} />
        )}
      </Pressable>

      <TodaysPhotosModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        photos={todaysPhotos}
        isLoading={historyLoading}
        onFetch={handleFetchTodaysPhotos}
        onDelete={deletePhotoFromToday}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 100 },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 8,
  },
  settingsButtonPressed: {
    opacity: 0.7,
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
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
    marginTop: 14,
  },
  moodColumn: {
    alignItems: 'center',
    minWidth: 100,
  },
  moodColumnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    opacity: 0.7,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  moodPillPartner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  moodPillSelf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 248, 245, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.blushDark,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  moodPillPressed: {
    opacity: 0.9,
  },
  moodEmoji: {
    fontSize: 18,
  },
  moodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 88,
  },
  moodPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  moodSetStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  moodPencilIcon: {
    marginLeft: 4,
    opacity: 0.8,
  },
  partnerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  partnerTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  partnerId: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cards: { gap: 20 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  halfCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  halfCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  weatherLoader: { marginTop: 4 },
  batteryCard: {
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batteryPct: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  batteryUpdated: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  batteryLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  distanceCard: {
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  historyButton: {
    position: 'absolute',
    left: 24,
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
  uploadModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  uploadModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  uploadPreviewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  uploadCaptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  uploadCaptionInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    maxLength: 60,
  },
  uploadCharCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
  uploadModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  uploadConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.blushDark,
    alignItems: 'center',
  },
  uploadButtonPressed: {
    opacity: 0.9,
  },
  uploadCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  uploadConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted + '99',
    alignSelf: 'center',
    marginBottom: 16,
  },
  widgetPhotoSheet: {
    maxHeight: '80%',
  },
  widgetPhotoSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  widgetPhotoChooseAnother: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 16,
  },
  widgetPhotoChooseAnotherText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.skyDark,
  },
  widgetPhotoRemoveBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  widgetPhotoRemoveBgText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
});
