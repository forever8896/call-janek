// Infinite horizontal Prague skyline. The source PNG isn't perfectly tileable
// at its left/right edges, so we lay [original][mirrored][original][mirrored]
// — every seam meets its own mirror, making the loop invisible.

import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SOURCE = require('@/assets/images/prague-sidescroll.png');
const ASPECT = 2172 / 724; // ≈ 3.0

export function PragueScroll({
  height = 100,
  opacity = 0.55,
  speedPxPerSec = 18,
  style,
}: {
  height?: number;
  opacity?: number;
  speedPxPerSec?: number;
  style?: ViewStyle;
}) {
  const tileWidth = height * ASPECT;
  const [containerWidth, setContainerWidth] = useState(0);
  const tx = useSharedValue(0);

  useEffect(() => {
    // Loop length = one (original + mirrored) pair so seams are mirror-matched.
    const loopLength = tileWidth * 2;
    const duration = (loopLength / speedPxPerSec) * 1000;
    tx.value = 0;
    tx.value = withRepeat(
      withTiming(-loopLength, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [tileWidth, speedPxPerSec, tx]);

  // Render enough tile pairs to cover container width + one extra pair so the
  // animation can drift before snapping back.
  const pairsNeeded = Math.max(2, Math.ceil(containerWidth / (tileWidth * 2)) + 1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={onLayout}
      style={[{ height, overflow: 'hidden', opacity }, style]}
    >
      <Animated.View
        style={[{ flexDirection: 'row', height, width: tileWidth * 2 * pairsNeeded }, animatedStyle]}
      >
        {Array.from({ length: pairsNeeded }).flatMap((_, i) => [
          <Image
            key={`o-${i}`}
            source={SOURCE}
            style={{ width: tileWidth, height }}
            contentFit="cover"
          />,
          <Image
            key={`m-${i}`}
            source={SOURCE}
            style={{
              width: tileWidth,
              height,
              transform: [{ scaleX: -1 }],
            }}
            contentFit="cover"
          />,
        ])}
      </Animated.View>
    </View>
  );
}
