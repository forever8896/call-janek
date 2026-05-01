import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { JanekAvatar } from '@/components/illustrations';
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
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={[
            {
              width: 36,
              height: 36,
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
          <Text style={{ fontFamily: FONT.bodyBold, fontSize: 16, color: HG.ink }}>←</Text>
        </Pressable>
      ) : (
        <JanekAvatar size={36} />
      )}
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
