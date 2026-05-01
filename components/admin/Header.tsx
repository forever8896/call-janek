import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Mascot } from '@/components/mascot';
import { useLang } from '@/lib/i18n';
import { BORDER, FONT, HG, RADIUS, hardShadow } from '@/theme/tokens';

export function AdminHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const { lang, toggle } = useLang();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 1.5,
        borderColor: HG.ink,
        backgroundColor: HG.sand,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            {
              width: 32,
              height: 32,
              borderRadius: RADIUS.sm,
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              alignItems: 'center',
              justifyContent: 'center',
            },
            hardShadow(2),
          ]}
        >
          <Text style={{ fontFamily: FONT.bodyBold, fontSize: 15, color: HG.ink }}>←</Text>
        </Pressable>
      )}
      {/* Janek (painted mascot) lives in the top-left of every newsroom screen */}
      <Mascot kind="janek" size={42} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONT.displaySemiItalic,
            fontSize: 19,
            color: HG.ink,
            lineHeight: 20,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontFamily: FONT.monoBold,
              fontSize: 10,
              color: HG.inkMute,
              marginTop: 3,
              letterSpacing: 0.4,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Language switcher — same affordance as the reporter top bar */}
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: HG.butter,
          borderWidth: BORDER.half,
          borderColor: HG.ink,
          borderRadius: 999,
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

      {right}
    </View>
  );
}

export function HeaderIconBtn({
  onPress,
  bg = HG.card,
  children,
}: {
  onPress?: () => void;
  bg?: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: RADIUS.sm,
        backgroundColor: bg,
        borderWidth: BORDER.half,
        borderColor: HG.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: FONT.bodyBold, color: HG.ink }}>{children}</Text>
    </Pressable>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.bodyBold,
          fontSize: 11,
          color: HG.inkMute,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}
