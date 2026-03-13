import { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, Image, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * Custom camera inside a Polaroid frame:
 * - Live viewfinder in a white Polaroid card; capture crops to square and flips selfies
 * - Preview keeps the same Polaroid layout, showing the cropped image in the frame
 */
export function CustomCamera({ onPhotoCaptured, onClose }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');
  const [previewImage, setPreviewImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (!photo?.uri) return;

      let width = photo.width;
      let height = photo.height;
      if (width == null || height == null) {
        const dims = await new Promise((res, rej) => {
          Image.getSize(photo.uri, (w, h) => res({ width: w, height: h }), rej);
        });
        width = dims.width;
        height = dims.height;
      }

      const actions = [];
      if (height > width) {
        actions.push({
          crop: {
            originX: 0,
            originY: (height - width) / 2,
            width,
            height: width,
          },
        });
      } else if (width > height) {
        actions.push({
          crop: {
            originX: (width - height) / 2,
            originY: 0,
            width: height,
            height,
          },
        });
      }
      if (facing === 'front') {
        actions.push({ flip: FlipType.Horizontal });
      }

      const result = await manipulateAsync(photo.uri, actions, {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      setPreviewImage(result.uri);
    } catch (e) {
      console.warn('[CustomCamera] takePicture failed', e?.message || e);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setPreviewImage(null);
  };

  const handleUsePhoto = () => {
    if (previewImage) {
      onPhotoCaptured?.(previewImage);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Loading camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera access is required to take photos.</Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  // Single layout: Polaroid card with either live camera or preview image
  return (
    <View style={styles.container}>
      <View style={styles.polaroidCard}>
        <View style={styles.polaroidHole}>
          {previewImage ? (
            <Image
              source={{ uri: previewImage }}
              style={styles.polaroidImage}
              resizeMode="cover"
            />
          ) : (
            <CameraView ref={cameraRef} style={styles.viewfinderCamera} facing={facing} />
          )}
        </View>
      </View>

      {previewImage ? (
        <View style={[styles.previewOverlay, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            style={({ pressed }) => [styles.previewButton, pressed && styles.buttonPressed]}
            onPress={handleRetake}
          >
            <Text style={styles.previewButtonText}>Retake</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.previewButton, styles.usePhotoButton, pressed && styles.buttonPressed]}
            onPress={handleUsePhoto}
          >
            <Text style={[styles.previewButtonText, styles.usePhotoButtonText]}>Use Photo</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={onClose}
            >
              <Ionicons name="close" size={28} color={colors.white} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            >
              <Ionicons name="camera-reverse" size={28} color={colors.white} />
            </Pressable>
          </View>
          <View style={[styles.captureRow, { paddingBottom: insets.bottom + 32 }]}>
            <Pressable
              style={({ pressed }) => [
                styles.captureButton,
                isCapturing && styles.captureButtonDisabled,
                pressed && !isCapturing && styles.buttonPressed,
              ]}
              onPress={takePicture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <View style={styles.captureButtonInnerDisabled} />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  polaroidCard: {
    backgroundColor: colors.white,
    padding: 16,
    paddingBottom: 60,
    width: '88%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  polaroidHole: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  polaroidImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  viewfinderCamera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.blushDark,
    borderRadius: 12,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
  },
  captureButtonInnerDisabled: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  captureButtonDisabled: {
    opacity: 0.8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usePhotoButton: {
    backgroundColor: colors.blushDark,
  },
  previewButtonText: {
    fontSize: 17,
    color: colors.white,
    fontWeight: '600',
  },
  usePhotoButtonText: {
    color: colors.white,
  },
});
