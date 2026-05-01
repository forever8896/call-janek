import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Btn, Card, Chip, Waveform } from '@/components/atoms';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { ApiError, transcribeAudio } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Recording() {
  const router = useRouter();
  const t = useT();
  const { session } = useAuth();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const startedRef = useRef(false);

  // Animations
  const ringRot = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(ringRot, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, [blink, ringRot]);

  // Request permission + auto-start.
  // Don't touch `recorder` in the cleanup: the hook releases its native
  // handle on unmount and accessing it after release crashes the bridge.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!status.granted) {
          setPermission('denied');
          return;
        }
        setPermission('granted');
        if (!startedRef.current) {
          startedRef.current = true;
          await recorder.prepareToRecordAsync();
          recorder.record();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCancel = async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {}
    router.back();
  };

  const onStop = async () => {
    setError(null);
    setTranscribing(true);
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording available');

      // High-quality preset → .m4a / audio/mp4 on both platforms.
      const fileName = `tip-${Date.now()}.m4a`;
      const mimeType = 'audio/mp4';

      const res = await transcribeAudio({ uri, mimeType, fileName });

      router.replace({
        pathname: '/(reporter)/review',
        params: {
          transcript: res.transcript,
          audioPath: res.audio_path,
          audioMime: res.mime_type,
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setTranscribing(false);
    }
  };

  const spin = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const durationMs = recorderState.durationMillis ?? 0;

  return (
    <ReporterShell bg={HG.peach}>
      <ReporterTopBar
        title={
          permission === 'granted'
            ? t('● Recording', '● Nahrávám')
            : permission === 'denied'
              ? t('Microphone blocked', 'Mikrofon blokován')
              : t('Starting…', 'Začínám…')
        }
      />
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <View
          style={[
            {
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: HG.red,
              borderWidth: BORDER.full,
              borderColor: HG.ink,
              alignItems: 'center',
              justifyContent: 'center',
            },
            hardShadow(6),
          ]}
        >
          {permission === 'granted' && (
            <Animated.View
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: 90,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: HG.ink,
                transform: [{ rotate: spin }],
              }}
            />
          )}
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
        </View>

        <Chip bg={HG.cream}>
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: HG.red,
              opacity: blink,
            }}
          />
          <Text style={{ fontFamily: FONT.bodyBold, fontSize: 12, color: HG.ink }}>
            {permission === 'granted' ? formatDuration(durationMs) : '0:00'}
          </Text>
        </Chip>

        <Card pad={14} style={{ width: '100%' }}>
          <Waveform active={permission === 'granted' && recorderState.isRecording} />
        </Card>

        {permission === 'denied' ? (
          <Text
            style={{
              fontFamily: FONT.displayItalic,
              fontSize: 16,
              textAlign: 'center',
              color: HG.inkSoft,
              lineHeight: 22,
            }}
          >
            {t(
              'We need mic access. Open Settings → Permissions → Microphone.',
              'Potřebujeme přístup k mikrofonu. Otevři Nastavení → Oprávnění.',
            )}
          </Text>
        ) : (
          <Text
            style={{
              fontFamily: FONT.displayItalic,
              fontSize: 18,
              textAlign: 'center',
              color: HG.inkSoft,
              lineHeight: 24,
            }}
          >
            “{t('Take your time. What happened, where, who.', 'Nespěchejte. Co, kde, kdo.')}”
          </Text>
        )}

        {error && (
          <Card pad={10} bg={HG.redSoft}>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: HG.ink }}>
              {error}
            </Text>
          </Card>
        )}
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 28,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Btn full onPress={onCancel} bg={HG.card}>
          {t('Cancel', 'Zrušit')}
        </Btn>
        <Btn
          primary
          full
          bg={permission === 'denied' ? HG.inkDim : HG.red}
          color={HG.cream}
          onPress={onStop}
        >
          {transcribing ? (
            <ActivityIndicator color={HG.cream} />
          ) : permission === 'denied' ? (
            t('No mic', 'Bez mikrofonu')
          ) : durationMs < 1000 ? (
            t('Hold on…', 'Moment…')
          ) : (
            t('Stop & review', 'Stop a zkontrolovat')
          )}
        </Btn>
      </View>
    </ReporterShell>
  );
}
