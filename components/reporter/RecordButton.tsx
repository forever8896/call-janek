import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

export function RecordButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}
    >
      {[3, 2, 1].map((i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 220 + i * 16,
            height: 220 + i * 16,
            borderRadius: (220 + i * 16) / 2,
            backgroundColor: HG.redSoft,
            opacity: 0.18 - i * 0.04,
            borderStyle: i === 1 ? 'dashed' : 'solid',
            borderWidth: i === 1 ? 2 : 0,
            borderColor: HG.ink,
          }}
        />
      ))}
      <View
        style={[
          {
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: HG.red,
            borderWidth: BORDER.full,
            borderColor: HG.ink,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          },
          hardShadow(6),
        ]}
      >
        <Svg width={60} height={60} viewBox="0 0 24 24" fill="none">
          <Rect
            x={9}
            y={3}
            width={6}
            height={13}
            rx={3}
            fill={HG.cream}
            stroke={HG.ink}
            strokeWidth={1.2}
          />
          <Path
            d="M5 11a7 7 0 0014 0M12 18v3"
            stroke={HG.cream}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <Text
          style={{
            fontFamily: FONT.displaySemiItalic,
            fontSize: 17,
            color: HG.cream,
          }}
        >
          Tap to record
        </Text>
      </View>
    </Pressable>
  );
}
