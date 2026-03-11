import { VStack, Text, Spacer } from '@expo/ui/swift-ui';
import {
  containerRelativeFrame,
  padding,
  font,
  background,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
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

  // Duva brand colors
  const bgColor = '#FFF8F5';
  const textColor = '#8A7878';
  const subtleTextColor = '#8A7878';

  if (hasNewPhoto) {
    return (
      <VStack
        alignment="center"
        modifiers={[
          containerRelativeFrame({ axes: 'both' }),
          padding({ all: 16 }),
          background(bgColor),
        ]}
      >
        <Spacer />
        <Text modifiers={[font({ size: 40 }), foregroundStyle(textColor)]}>{moodEmoji}</Text>
        <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle(textColor)]}>
          A new memory from {partnerName} is waiting...
        </Text>
        <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(subtleTextColor)]}>
          Tap to view ✨
        </Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      modifiers={[
        containerRelativeFrame({ axes: 'both' }),
        padding({ all: 16 }),
        background(bgColor),
      ]}
    >
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(textColor)]}>
        {partnerName}'s Status
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 14 }), foregroundStyle(subtleTextColor)]}>
        Time: {partnerTime}
      </Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(subtleTextColor)]}>
        Weather: {partnerWeather}
      </Text>
    </VStack>
  );
};

export default createWidget('PartnerPictureWidget', PartnerPictureWidget);
