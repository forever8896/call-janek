import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BORDER, FONT, HG } from '@/theme/tokens';

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  // Pause when this component unmounts (navigating away)
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // player already torn down — fine
      }
    };
  }, [player]);

  const playing = status.playing;
  const duration = status.duration ?? 0;
  const elapsed = status.currentTime ?? 0;
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;

  const onToggle = () => {
    if (playing) {
      player.pause();
    } else {
      // If finished, seek back before play
      if (duration > 0 && elapsed >= duration - 0.1) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: HG.cream,
        borderWidth: BORDER.half,
        borderColor: HG.rule,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: HG.amberSoft,
          borderWidth: BORDER.half,
          borderColor: HG.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: FONT.bodyBold, color: HG.ink, fontSize: 14 }}>
          {playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            height: 6,
            backgroundColor: HG.rule,
            borderRadius: 3,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: HG.ink,
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: HG.red,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text
            style={{ fontFamily: FONT.monoBold, fontSize: 9, color: HG.inkMute }}
          >
            {formatDuration(elapsed)}
          </Text>
          <Text
            style={{ fontFamily: FONT.monoBold, fontSize: 9, color: HG.inkMute }}
          >
            {formatDuration(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}
