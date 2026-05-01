import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { CatIll } from '@/components/illustrations';
import { Urgency } from '@/components/atoms';
import type { UIRow } from '@/lib/mapping';
import { BORDER, FONT, HG } from '@/theme/tokens';

const ACCENT: Record<string, string> = {
  taxi: HG.amberSoft,
  exchange: HG.lilac,
  menu: HG.rose,
  online: HG.mint,
  pickpocket: HG.sky,
};

export function QueueRow({
  item,
  urgencyStyle = 'pill',
  onPress,
  index = 0,
}: {
  item: UIRow;
  urgencyStyle?: 'pill' | 'dot' | 'flame';
  onPress?: () => void;
  index?: number;
}) {
  const accent = ACCENT[item.cat] || HG.butter;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 35)
        .duration(300)
        .springify()
        .damping(14)}
      layout={LinearTransition.springify()}
    >
      <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <View
        style={{
          backgroundColor: HG.card,
          borderWidth: BORDER.half,
          borderColor: HG.rule,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          borderRadius: 14,
          padding: 12,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: accent,
            borderWidth: BORDER.half,
            borderColor: HG.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CatIll cat={item.cat} size={42} />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Urgency level={item.urgency} style={urgencyStyle} />
            {item.cluster > 1 && (
              <View
                style={{
                  backgroundColor: HG.lilac,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontFamily: FONT.bodyBold, fontSize: 10, color: HG.ink }}>
                  ×{item.cluster}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: HG.inkMute }}>
              {item.time}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: FONT.bodySemi,
              fontSize: 13,
              lineHeight: 18,
              color: HG.ink,
            }}
            numberOfLines={2}
          >
            {item.summary}
          </Text>
          <View
            style={{
              marginTop: 5,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: HG.inkMute }}>
              📍 {item.location}
            </Text>
            {item.media && (
              <>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: HG.inkMute }}>
                  ·
                </Text>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: HG.inkMute }}>
                  ◧ {item.media}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}
