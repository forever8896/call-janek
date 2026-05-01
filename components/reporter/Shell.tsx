import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLang } from '@/lib/i18n';
import { BORDER, FONT, HG, RADIUS, hardShadow } from '@/theme/tokens';

export function ReporterShell({
  children,
  bg = HG.cream,
  style,
}: {
  children: React.ReactNode;
  bg?: string;
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={[{ flex: 1, backgroundColor: bg }, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function ReporterTopBar({ title }: { title?: string }) {
  const { lang, toggle } = useLang();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={[
          {
            width: 38,
            height: 38,
            borderRadius: RADIUS.sm,
            backgroundColor: HG.red,
            borderWidth: BORDER.full,
            borderColor: HG.ink,
            alignItems: 'center',
            justifyContent: 'center',
          },
          hardShadow(2),
        ]}
      >
        <Text
          style={{
            color: HG.cream,
            fontFamily: FONT.displaySemi,
            fontSize: 18,
          }}
        >
          HG
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONT.displaySemiItalic,
            fontSize: 17,
            color: HG.ink,
            lineHeight: 18,
          }}
        >
          Honest Guide
        </Text>
        <Text
          style={{
            fontFamily: FONT.bodySemi,
            fontSize: 11,
            color: HG.inkMute,
          }}
        >
          {title || 'Tip line · Praha'}
        </Text>
      </View>
      <Pressable
        onPress={toggle}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: HG.butter,
          borderWidth: BORDER.half,
          borderColor: HG.ink,
          borderRadius: RADIUS.pill,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.bodyBold,
            fontSize: 11,
            color: HG.ink,
            letterSpacing: 0.5,
          }}
        >
          {lang} ↔
        </Text>
      </Pressable>
    </View>
  );
}
