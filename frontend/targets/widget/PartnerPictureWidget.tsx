import { VStack, Text, Spacer } from '@expo/ui/swift-ui';
import { containerRelativeFrame, padding, font } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type PartnerPictureWidgetProps = {
  partnerName?: string;
  moodEmoji?: string;
  hasNewPhoto?: boolean;
  partnerTime?: string;
  partnerWeather?: string;
};

const PartnerPictureWidget = (props: WidgetBase<PartnerPictureWidgetProps>) => {
  'widget';

  // Bulletproof fallbacks for the iOS Gallery Preview (props may be entirely undefined)
  const p = (props ?? {}) as Partial<PartnerPictureWidgetProps>;
  const partnerName = p.partnerName ?? 'Partner';
  const moodEmoji = p.moodEmoji ?? '💭';
  const hasNewPhoto = Boolean(p.hasNewPhoto);
  const partnerTime = p.partnerTime ?? '--:--';
  const partnerWeather = p.partnerWeather ?? '--°';

  if (hasNewPhoto) {
    return (
      <VStack
        alignment="center"
        modifiers={[containerRelativeFrame({ axes: 'both' }), padding({ all: 16 })]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 40 })]}>{moodEmoji}</Text>
        <Text modifiers={[font({ weight: 'medium', size: 15 })]}>
          A new memory from {partnerName} is waiting...
        </Text>
        <Text modifiers={[font({ weight: 'bold', size: 14 })]}>Tap to view ✨</Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      modifiers={[containerRelativeFrame({ axes: 'both' }), padding({ all: 16 })]}
    >
      <Text modifiers={[font({ weight: 'bold', size: 16 })]}>{partnerName}'s Status</Text>
      <Spacer />
      <Text modifiers={[font({ size: 14 })]}>Time: {partnerTime}</Text>
      <Text modifiers={[font({ size: 14 })]}>Weather: {partnerWeather}</Text>
    </VStack>
  );
};

export default createWidget('PartnerPictureWidget', PartnerPictureWidget);
