import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AdminHeader } from '@/components/admin/Header';
import { QueueRow } from '@/components/admin/QueueRow';
import { ApiError, adminSearch, transcribeAudio } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { toUIRow } from '@/lib/mapping';
import type { AdminSearchResponse } from '@/lib/types';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

const SUGGESTIONS_EN = [
  'What happened in the last hour?',
  'Any digital crime today?',
  'Show me critical taxi reports',
  'Trdelník stuff this week',
];
const SUGGESTIONS_CZ = [
  'Co se stalo za poslední hodinu?',
  'Nějaký online podvod dnes?',
  'Kritické taxi reporty',
  'Trdelník tipy tento týden',
];

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; summary: string; total: number }
  | { kind: 'error'; message: string };

export default function AdminSearch() {
  const router = useRouter();
  const t = useT();
  const SUGGESTIONS = t('en', 'cz') === 'cz' ? SUGGESTIONS_CZ : SUGGESTIONS_EN;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<AdminSearchResponse | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ─── voice ──────────────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recordingState, setRecordingState] = useState<
    'idle' | 'requesting' | 'recording' | 'transcribing'
  >('idle');

  const startRecording = async () => {
    setRecordingState('requesting');
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setRecordingState('idle');
        setTurns((prev) => [
          ...prev,
          { kind: 'error', message: t('Microphone permission denied.', 'Mikrofon zamítnut.') },
        ]);
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingState('recording');
    } catch (e) {
      setRecordingState('idle');
      setTurns((prev) => [
        ...prev,
        { kind: 'error', message: e instanceof Error ? e.message : String(e) },
      ]);
    }
  };

  const stopAndTranscribe = async () => {
    setRecordingState('transcribing');
    try {
      if (recorder.isRecording) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured');
      const { transcript } = await transcribeAudio({
        uri,
        mimeType: 'audio/mp4',
        fileName: `query-${Date.now()}.m4a`,
      });
      setRecordingState('idle');
      setInput(transcript);
      // Auto-fire the search if the transcript came back non-empty.
      if (transcript.trim().length > 0) {
        runSearch(transcript.trim());
      }
    } catch (e) {
      setRecordingState('idle');
      setTurns((prev) => [
        ...prev,
        { kind: 'error', message: e instanceof Error ? e.message : String(e) },
      ]);
    }
  };

  // ─── search ─────────────────────────────────────────────────
  const runSearch = async (q: string) => {
    if (!q || searching) return;
    setSearching(true);
    setTurns((prev) => [...prev, { kind: 'user', text: q }]);
    setInput('');
    try {
      const res = await adminSearch(q);
      setResult(res);
      setTurns((prev) => [
        ...prev,
        { kind: 'assistant', summary: res.summary, total: res.total },
      ]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setTurns((prev) => [...prev, { kind: 'error', message: msg }]);
    } finally {
      setSearching(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Pulse the mic button while recording
  useEffect(() => {
    if (recordingState === 'recording' && recorderState.isRecording === false) {
      // Recorder reports it stopped — nothing to do here, stop is user-driven.
    }
  }, [recordingState, recorderState.isRecording]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AdminHeader
          title={t('Ask Janek', 'Zeptej se')}
          subtitle={t('LLM SEARCH · VOICE OR TEXT', 'AI HLEDÁNÍ · HLAS NEBO TEXT')}
          onBack={() => router.back()}
        />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          {/* Empty state — hint at what to ask */}
          {turns.length === 0 && (
            <View style={{ padding: 16, gap: 12 }}>
              <Text
                style={{
                  fontFamily: FONT.displaySemiItalic,
                  fontSize: 22,
                  color: HG.ink,
                  lineHeight: 26,
                }}
              >
                {t('Ask anything about your queue.', 'Zeptej se na cokoliv ve frontě.')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.bodySemi,
                  fontSize: 13,
                  color: HG.inkMute,
                  lineHeight: 18,
                }}
              >
                {t(
                  '“Any digital crime today?” · “Critical taxis since yesterday” · “Trdelník reports this week”',
                  '„Online podvody dnes?“ · „Kritické taxi od včera“ · „Trdelník reporty tento týden“',
                )}
              </Text>
              <View style={{ marginTop: 6, gap: 6 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => runSearch(s)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: HG.card,
                      borderWidth: BORDER.half,
                      borderColor: HG.ink,
                      borderRadius: 999,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.bodyBold,
                        fontSize: 12,
                        color: HG.ink,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Conversation + results */}
          {turns.map((turn, i) => {
            if (turn.kind === 'user') {
              return (
                <Animated.View
                  key={i}
                  entering={FadeIn.duration(200)}
                  style={{ paddingHorizontal: 16, paddingTop: 10, alignItems: 'flex-end' }}
                >
                  <View
                    style={{
                      maxWidth: '85%',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      backgroundColor: HG.ink,
                      borderRadius: 18,
                      borderBottomRightRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.bodySemi,
                        fontSize: 13,
                        color: HG.cream,
                        lineHeight: 18,
                      }}
                    >
                      {turn.text}
                    </Text>
                  </View>
                </Animated.View>
              );
            }
            if (turn.kind === 'assistant') {
              return (
                <Animated.View
                  key={i}
                  entering={FadeIn.duration(200)}
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={[
                      {
                        maxWidth: '90%',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: HG.amberSoft,
                        borderRadius: 18,
                        borderBottomLeftRadius: 4,
                        borderWidth: BORDER.half,
                        borderColor: HG.ink,
                      },
                      hardShadow(2),
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.displayItalic,
                        fontSize: 14,
                        color: HG.ink,
                        lineHeight: 19,
                      }}
                    >
                      {turn.summary}
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: FONT.monoBold,
                        fontSize: 9,
                        color: HG.inkMute,
                        letterSpacing: 0.6,
                      }}
                    >
                      {turn.total}{' '}
                      {turn.total === 1
                        ? t('REPORT', 'TIP')
                        : turn.total < 5
                          ? t('REPORTS', 'TIPY')
                          : t('REPORTS', 'TIPŮ')}
                    </Text>
                  </View>
                </Animated.View>
              );
            }
            return (
              <Animated.View
                key={i}
                entering={FadeIn}
                style={{ paddingHorizontal: 16, paddingTop: 10, alignItems: 'flex-start' }}
              >
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: HG.redSoft,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT.monoBold,
                      fontSize: 11,
                      color: HG.ink,
                    }}
                  >
                    {turn.message}
                  </Text>
                </View>
              </Animated.View>
            );
          })}

          {/* Filtered results */}
          {result && result.reports.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text
                style={{
                  fontFamily: FONT.monoBold,
                  fontSize: 10,
                  color: HG.inkDim,
                  letterSpacing: 0.6,
                  paddingHorizontal: 16,
                  paddingBottom: 6,
                }}
              >
                {t('MATCHES · URGENCY ↓', 'VÝSLEDKY · NALÉHAVOST ↓')}
              </Text>
              {result.reports.map((item, idx) => (
                <QueueRow
                  key={item.id}
                  item={toUIRow(item)}
                  index={idx}
                  onPress={() => router.push(`/(admin)/detail?id=${item.id}`)}
                />
              ))}
            </View>
          )}
          {result && result.reports.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: FONT.displayItalic,
                  fontSize: 14,
                  color: HG.inkMute,
                }}
              >
                {t('Nothing matches that.', 'Nic nenalezeno.')}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 10,
            borderTopWidth: 1.5,
            borderColor: HG.rule,
            backgroundColor: HG.sand,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              minHeight: 44,
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingVertical: 8,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                recordingState === 'recording'
                  ? t('● Recording — tap mic to stop', '● Nahrávám — klepni na mikrofon')
                  : recordingState === 'transcribing'
                    ? t('Transcribing…', 'Přepisuji…')
                    : t('Ask about your queue…', 'Zeptej se na frontu…')
              }
              placeholderTextColor={HG.inkMute}
              style={{
                fontFamily: FONT.bodySemi,
                fontSize: 14,
                color: HG.ink,
                paddingVertical: 0,
                minHeight: 28,
              }}
              editable={recordingState === 'idle' && !searching}
              multiline
              onSubmitEditing={() => runSearch(input.trim())}
              returnKeyType="search"
              blurOnSubmit
            />
          </View>

          {/* Mic button */}
          <Pressable
            onPress={
              recordingState === 'idle'
                ? startRecording
                : recordingState === 'recording'
                  ? stopAndTranscribe
                  : undefined
            }
            disabled={recordingState === 'requesting' || recordingState === 'transcribing'}
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: BORDER.half,
                borderColor: HG.ink,
                backgroundColor:
                  recordingState === 'recording' ? HG.red : HG.amberSoft,
                alignItems: 'center',
                justifyContent: 'center',
              },
              hardShadow(2),
            ]}
          >
            {recordingState === 'transcribing' || recordingState === 'requesting' ? (
              <ActivityIndicator color={HG.ink} />
            ) : (
              <Text style={{ fontSize: 20 }}>
                {recordingState === 'recording' ? '■' : '🎙'}
              </Text>
            )}
          </Pressable>

          {/* Send button */}
          <Pressable
            onPress={() => runSearch(input.trim())}
            disabled={!input.trim() || searching || recordingState !== 'idle'}
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: BORDER.half,
                borderColor: HG.ink,
                backgroundColor:
                  !input.trim() || searching ? HG.inkDim : HG.ink,
                alignItems: 'center',
                justifyContent: 'center',
              },
              hardShadow(2),
            ]}
          >
            {searching ? (
              <ActivityIndicator color={HG.cream} />
            ) : (
              <Text style={{ fontSize: 18, color: HG.cream, fontFamily: FONT.bodyBold }}>
                ↑
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
