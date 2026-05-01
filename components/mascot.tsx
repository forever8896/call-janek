// Real character art (replaces SVGs where we have a PNG for that category).
// Bobble animation is opt-in so we don't pay the cost on the queue list rows.

import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type MascotKind =
  | 'trdelnik_mogger'   // angry — high urgency / restaurant_scam crit
  | 'trdelnik_soyboy'   // friendly — confirmation, empty states
  | 'exchange_scammer'  // fake_exchange
  | 'angry_sunka'       // food/tourist trap; secondary mascot
  | 'taxi_scam'         // taxi_scam category
  | 'phone_phishing'    // online_fraud category
  | 'janek'             // admin self-portrait
  | 'sad_tourist';      // offline / empty states

const SOURCES: Record<MascotKind, number> = {
  trdelnik_mogger:  require('@/assets/images/trdelnik_mogger.png'),
  trdelnik_soyboy:  require('@/assets/images/trdelnik_soyboy.png'),
  exchange_scammer: require('@/assets/images/exchange-scammer.png'),
  angry_sunka:      require('@/assets/images/angry_sunka.png'),
  taxi_scam:        require('@/assets/images/taxi_scam.png'),
  phone_phishing:   require('@/assets/images/phone_phising.png'),
  janek:            require('@/assets/images/janek.png'),
  sad_tourist:      require('@/assets/images/sad_tourist.png'),
};

export function Mascot({
  kind,
  size = 96,
  bobble = false,
  rotate = 0,
  delay = 0,
  style,
}: {
  kind: MascotKind;
  size?: number;
  bobble?: boolean;
  rotate?: number;       // base rotation in degrees
  delay?: number;        // ms before the bobble starts (stagger floating clusters)
  style?: ViewStyle;
}) {
  const source = SOURCES[kind];

  if (!bobble) {
    return (
      <View
        style={[
          { width: size, height: size, transform: [{ rotate: `${rotate}deg` }] },
          style,
        ]}
      >
        <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      </View>
    );
  }

  return <BobbleMascot source={source} size={size} rotate={rotate} delay={delay} style={style} />;
}

function BobbleMascot({
  source,
  size,
  rotate,
  delay,
  style,
}: {
  source: number;
  size: number;
  rotate: number;
  delay: number;
  style?: ViewStyle;
}) {
  const y = useSharedValue(0);
  const r = useSharedValue(rotate);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    r.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(rotate + 3, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
          withTiming(rotate - 3, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [y, r, rotate, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, animatedStyle, style]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </Animated.View>
  );
}

// Pick a mascot by report category — useful for queue digest band etc.
export function categoryMascot(
  category: 'taxi_scam' | 'fake_exchange' | 'online_fraud' | 'restaurant_scam' | 'other',
  intensity: 'high' | 'low' = 'high',
): MascotKind | null {
  if (category === 'taxi_scam') return 'taxi_scam';
  if (category === 'fake_exchange') return 'exchange_scammer';
  if (category === 'online_fraud') return 'phone_phishing';
  if (category === 'restaurant_scam') {
    return intensity === 'high' ? 'trdelnik_mogger' : 'trdelnik_soyboy';
  }
  // 'other' has no mascot
  return null;
}
