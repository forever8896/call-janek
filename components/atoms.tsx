import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { BORDER, FONT, HG, RADIUS, hardShadow } from '@/theme/tokens';

// ─── Chip ─────────────────────────────────────────────────────
export function Chip({
  children,
  bg = HG.butter,
  color = HG.ink,
  sm = false,
  hard = true,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  sm?: boolean;
  hard?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          paddingHorizontal: sm ? 8 : 10,
          paddingVertical: sm ? 4 : 6,
          borderRadius: RADIUS.pill,
          borderWidth: hard ? BORDER.half : 0,
          borderColor: HG.ink,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            {
              fontFamily: FONT.bodyBold,
              fontSize: sm ? 11 : 12,
              color,
              letterSpacing: -0.1,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        <ChipChildren color={color} sm={sm} textStyle={textStyle}>
          {children}
        </ChipChildren>
      )}
    </View>
  );
}

function ChipChildren({
  children,
  color,
  sm,
  textStyle,
}: {
  children: React.ReactNode;
  color: string;
  sm: boolean;
  textStyle?: TextStyle;
}) {
  return (
    <>
      {React.Children.map(children, (c) =>
        typeof c === 'string' ? (
          <Text
            style={[
              {
                fontFamily: FONT.bodyBold,
                fontSize: sm ? 11 : 12,
                color,
                letterSpacing: -0.1,
              },
              textStyle,
            ]}
          >
            {c}
          </Text>
        ) : (
          c
        ),
      )}
    </>
  );
}

// ─── Card (with hard offset shadow) ───────────────────────────
export function Card({
  children,
  bg = HG.card,
  pad = 16,
  shadow = true,
  style,
  ...rest
}: {
  children: React.ReactNode;
  bg?: string;
  pad?: number;
  shadow?: boolean;
  style?: ViewStyle;
} & ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderColor: HG.ink,
          borderWidth: BORDER.full,
          borderRadius: RADIUS.lg,
          padding: pad,
        },
        shadow && hardShadow(4),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────
export function Btn({
  children,
  primary,
  bg,
  color,
  onPress,
  full,
  sm,
  style,
}: {
  children: React.ReactNode;
  primary?: boolean;
  bg?: string;
  color?: string;
  onPress?: () => void;
  full?: boolean;
  sm?: boolean;
  style?: ViewStyle;
}) {
  const _bg = bg || (primary ? HG.ink : HG.card);
  const _co = color || (primary ? HG.cream : HG.ink);
  const base: ViewStyle = {
    backgroundColor: _bg,
    borderColor: HG.ink,
    borderWidth: BORDER.full,
    borderRadius: RADIUS.pill,
    paddingHorizontal: sm ? 14 : 18,
    paddingVertical: sm ? 10 : 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: full ? 'stretch' : 'flex-start',
    flexGrow: full ? 1 : 0,
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        hardShadow(2),
        { opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: FONT.bodyBold,
          fontSize: sm ? 13 : 15,
          color: _co,
          letterSpacing: -0.2,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// ─── Hairline ────────────────────────────────────────────────
export function Hairline({
  color = HG.rule,
  dashed,
  style,
}: {
  color?: string;
  dashed?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          width: '100%',
          borderTopWidth: 1,
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        style,
      ]}
    />
  );
}

// ─── Urgency ─────────────────────────────────────────────────
const URGENCY_LEVELS = [
  { bg: HG.greenSoft, fg: HG.ink, dot: HG.green, label: 'low' },
  { bg: HG.amberSoft, fg: HG.ink, dot: HG.amber, label: 'med' },
  { bg: HG.redSoft, fg: HG.ink, dot: HG.red, label: 'high' },
  { bg: HG.red, fg: HG.cream, dot: HG.cream, label: 'crit' },
];

export function Urgency({
  level = 2,
  style: variant = 'pill',
}: {
  level?: 1 | 2 | 3 | 4;
  style?: 'pill' | 'dot' | 'flame';
}) {
  const c = URGENCY_LEVELS[level - 1];
  if (variant === 'dot') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.dot,
            borderWidth: BORDER.half,
            borderColor: HG.ink,
          }}
        />
        <Text
          style={{
            fontFamily: FONT.bodyBold,
            fontSize: 11,
            color: HG.ink,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {c.label}
        </Text>
      </View>
    );
  }
  if (variant === 'flame') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Text key={i} style={{ fontSize: 12, opacity: i <= level ? 1 : 0.18 }}>
              {i <= level ? '🔥' : '○'}
            </Text>
          ))}
        </View>
        <Text
          style={{
            fontFamily: FONT.bodyBold,
            fontSize: 11,
            color: c.dot,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {c.label}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: RADIUS.pill,
        borderWidth: BORDER.half,
        borderColor: HG.ink,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
      }}
    >
      {level >= 3 && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: c.dot,
          }}
        />
      )}
      <Text
        style={{
          fontFamily: FONT.bodyBold,
          fontSize: 11,
          color: c.fg,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {c.label}
      </Text>
    </View>
  );
}

// ─── Waveform (animated) ─────────────────────────────────────
export function Waveform({
  active = true,
  color = HG.red,
  bars = 36,
}: {
  active?: boolean;
  color?: string;
  bars?: number;
}) {
  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const x = Math.sin(i * 1.7) * 0.5 + 0.5;
        return Math.max(0.15, x * (Math.sin(i * 0.4) * 0.3 + 0.7));
      }),
    [bars],
  );

  const anims = useRef(heights.map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) => a.setValue(0.7));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: 1.1,
            duration: 600,
            delay: i * 40,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, anims]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 80,
        justifyContent: 'center',
      }}
    >
      {heights.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: h * 70,
            backgroundColor: color,
            borderRadius: 3,
            borderWidth: 1.5,
            borderColor: HG.ink,
            transform: [{ scaleY: anims[i] }],
          }}
        />
      ))}
    </View>
  );
}
