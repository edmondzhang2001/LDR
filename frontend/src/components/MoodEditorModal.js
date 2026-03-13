import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const MOOD_PRESETS = [
  { emoji: '💻', label: 'Working' },
  { emoji: '😴', label: 'Sleeping' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '✈️', label: 'Traveling' },
  { emoji: '🥺', label: 'Miss U' },
  { emoji: '❤️', label: 'Thinking of u' },
  { emoji: '☕', label: 'Coffee break' },
  { emoji: '📚', label: 'Studying' },
];

const MAX_CUSTOM_LEN = 15;

export function MoodEditorModal({ visible, currentMood, onSave, onClose }) {
  const [emoji, setEmoji] = useState(currentMood?.emoji ?? '');
  const [text, setText] = useState(currentMood?.text ?? '');

  const handleSelectPreset = (preset) => {
    setEmoji(preset.emoji);
    setText(preset.label);
  };

  const handleSave = () => {
    onSave(emoji.trim() || null, text.trim().slice(0, MAX_CUSTOM_LEN) || null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Set your status</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Quick picks</Text>
          <View style={styles.presetGrid}>
            {MOOD_PRESETS.map((preset) => (
              <Pressable
                key={preset.emoji + preset.label}
                style={({ pressed }) => [
                  styles.presetButton,
                  emoji === preset.emoji && text === preset.label && styles.presetButtonSelected,
                  pressed && styles.presetButtonPressed,
                ]}
                onPress={() => handleSelectPreset(preset)}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={styles.presetLabel} numberOfLines={1}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Custom status (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. On a walk"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            maxLength={MAX_CUSTOM_LEN}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.charCount}>{text.length}/{MAX_CUSTOM_LEN}</Text>

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  presetButton: {
    width: '30%',
    minWidth: 90,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetButtonSelected: {
    borderColor: colors.blushDark,
    backgroundColor: colors.blush,
  },
  presetButtonPressed: {
    opacity: 0.85,
  },
  presetEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: colors.blushDark,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
