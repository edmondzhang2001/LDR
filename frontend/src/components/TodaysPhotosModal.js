import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const BORDER_PINK = '#F5D0D0';
const INNER_RADIUS = 10;
const FRAME_PADDING = 10;
const FRAME_CHIN = 28;

function formatStampDate(createdAt) {
  if (!createdAt) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(createdAt));
}

export function TodaysPhotosModal({ visible, onClose, photos, onDelete, isLoading, onFetch }) {
  const [deletingId, setDeletingId] = useState(null);
  const gap = 12;
  const numCols = 2;

  useEffect(() => {
    if (visible && onFetch) onFetch();
  }, [visible, onFetch]);

  const handleDelete = (photo) => {
    if (!photo) return;
    Alert.alert(
      'Delete this picture?',
      'Your partner will no longer see it in their widget.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(photo.id);
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              await onDelete(photo.id);
              if ((photos ?? []).length <= 1) onClose();
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const caption = item.caption?.trim();
    const dateStr = formatStampDate(item.createdAt);
    return (
      <View style={styles.polaroidWrap}>
        <View style={styles.polaroidFrame}>
          <View style={styles.polaroidInner}>
            <Image
              source={{ uri: item.thumbnailUrl || item.url }}
              style={styles.polaroidImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.stampBar}>
            {caption ? (
              <Text style={styles.stampCaption} numberOfLines={2} ellipsizeMode="tail">
                "{caption}"
              </Text>
            ) : null}
            <Text style={[styles.stampDate, caption && styles.stampDateWithCaption]}>
              {dateStr || '—'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.deleteOverlay, pressed && styles.btnPressed]}
            onPress={() => handleDelete(item)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.white} />
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Today's Photos</Text>
          <View style={styles.headerRight} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.blushDark} />
          </View>
        ) : (photos ?? []).length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="images-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No photos from the last 24 hours</Text>
          </View>
        ) : (
          <FlatList
            data={photos ?? []}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={numCols}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.shadow,
  },
  closeBtn: { padding: 8 },
  btnPressed: { opacity: 0.7 },
  headerRight: { minWidth: 44 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: colors.textMuted },
  gridContent: { padding: 12, paddingBottom: 40 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  polaroidWrap: { flex: 1 },
  polaroidFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: BORDER_PINK,
    padding: FRAME_PADDING,
    paddingBottom: FRAME_CHIN,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  polaroidInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: INNER_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  stampBar: {
    paddingTop: 8,
    paddingHorizontal: 6,
    minHeight: 36,
  },
  stampCaption: {
    fontSize: 12,
    color: '#5C4A4A',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  stampDate: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stampDateWithCaption: {
    fontSize: 10,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
