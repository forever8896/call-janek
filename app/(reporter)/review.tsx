import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Btn, Card, Chip } from '@/components/atoms';
import { IllTaxi } from '@/components/illustrations';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { ApiError, submitReport, uploadAttachment } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

const MAX_ATTACHMENTS = 5;

type Attachment = {
  uri: string;          // local URI, used for thumbnail
  storagePath: string;  // remote path, sent on submit
  kind: 'image' | 'video';
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONT.bodyBold,
        fontSize: 11,
        color: HG.inkMute,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

type Params = {
  transcript?: string;
  audioPath?: string;
  audioMime?: string;
};

export default function Review() {
  const router = useRouter();
  const t = useT();
  const { session } = useAuth();
  const params = useLocalSearchParams<Params>();
  const fromVoice = !!params.audioPath;

  const [text, setText] = useState(
    params.transcript?.trim() || t('Tap here to write your tip…', 'Sem napiš svůj tip…'),
  );
  const [location, setLocation] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAddMore = attachments.length < MAX_ATTACHMENTS && !picking;

  const onAdd = async () => {
    setError(null);
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          t(
            'Photo permission denied. Open Settings to allow access.',
            'Přístup k fotkám zamítnut. Povol v Nastavení.',
          ),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.7,
        videoMaxDuration: 30,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const mimeType =
        asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');

      const storagePath = await uploadAttachment({
        uri: asset.uri,
        mimeType,
        kind: isVideo ? 'video' : 'image',
      });

      setAttachments((prev) => [
        ...prev,
        { uri: asset.uri, storagePath, kind: isVideo ? 'video' : 'image' },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  };

  const onRemove = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSend = async () => {
    if (text.trim().length < 10) {
      setError(t('Tip is too short.', 'Tip je příliš krátký.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitReport({
        text_description: text.trim(),
        location: location.trim() || undefined,
        media_paths: attachments.map((a) => a.storagePath),
        audio_path: params.audioPath,
        audio_mime_type: params.audioMime,
        reporter_id: session?.user?.id,
      });
      router.replace({
        pathname: '/(reporter)/confirm',
        params: { id: res.report_id },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReporterShell>
      <ReporterTopBar title={fromVoice ? t('Review your tip', 'Zkontroluj tip') : t('Write a tip', 'Napiš tip')} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      >
        {fromVoice && (
          <Card
            pad={12}
            bg={HG.mint}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}
          >
            <Text style={{ fontSize: 28 }}>🎙️</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONT.bodyBold,
                  fontSize: 11,
                  color: HG.inkMute,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('Transcribed from your voice', 'Přepsáno z hlasu')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.displaySemiItalic,
                  fontSize: 16,
                  color: HG.ink,
                }}
              >
                {t('Tweak it, then send.', 'Uprav, pak pošli.')}
              </Text>
            </View>
          </Card>
        )}
        {!fromVoice && (
          <Card
            pad={12}
            bg={HG.amberSoft}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}
          >
            <IllTaxi size={42} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONT.bodyBold,
                  fontSize: 11,
                  color: HG.inkMute,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('Tell us', 'Pověz')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.displaySemiItalic,
                  fontSize: 16,
                  color: HG.ink,
                }}
              >
                {t('What happened, where, who.', 'Co, kde, kdo.')}
              </Text>
            </View>
          </Card>
        )}

        <Label>{t('Your story · tap to edit', 'Váš příběh · klepněte')}</Label>
        <Card pad={14} bg={HG.paper}>
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
            placeholderTextColor={HG.inkMute}
            style={{
              fontFamily: FONT.bodySemi,
              fontSize: 14,
              lineHeight: 22,
              color: HG.ink,
              padding: 0,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
            editable={!submitting}
          />
        </Card>

        <View style={{ height: 14 }} />
        <Label>{t('Where', 'Kde')}</Label>
        <Card pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: HG.mint,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"
                stroke={HG.ink}
                strokeWidth={2}
              />
              <Circle cx={12} cy={9} r={2.5} stroke={HG.ink} strokeWidth={2} />
            </Svg>
          </View>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={t('Place or business', 'Místo nebo podnik')}
            placeholderTextColor={HG.inkMute}
            style={{
              flex: 1,
              fontFamily: FONT.bodyBold,
              fontSize: 14,
              color: HG.ink,
              padding: 0,
            }}
            editable={!submitting}
          />
        </Card>

        <View style={{ height: 14 }} />
        <Label>{t('Evidence · optional', 'Důkazy · volitelné')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {attachments.map((a, i) => (
            <Pressable
              key={`${a.storagePath}-${i}`}
              onLongPress={() => onRemove(i)}
              disabled={submitting}
              style={[
                {
                  width: 96,
                  height: 78,
                  borderRadius: 12,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  overflow: 'hidden',
                  backgroundColor: HG.peach,
                },
                hardShadow(2),
              ]}
            >
              <Image
                source={{ uri: a.uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: HG.ink,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.bodyBold,
                    fontSize: 9,
                    color: HG.cream,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {a.kind === 'video' ? '▶ vid' : '✓ img'}
                </Text>
              </View>
            </Pressable>
          ))}

          {canAddMore && (
            <Pressable
              onPress={onAdd}
              disabled={submitting}
              style={{
                width: 96,
                height: 78,
                backgroundColor: HG.card,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: HG.ink,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {picking ? (
                <ActivityIndicator color={HG.ink} />
              ) : (
                <>
                  <Text style={{ fontSize: 22, color: HG.ink, lineHeight: 24 }}>+</Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: FONT.bodyBold,
                      fontSize: 11,
                      color: HG.inkMute,
                    }}
                  >
                    ADD
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {attachments.length > 0 && (
          <Text
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: HG.inkMute,
              marginTop: 6,
              fontStyle: 'italic',
            }}
          >
            {t('Long-press to remove', 'Dlouhý stisk pro odebrání')}
          </Text>
        )}

        <Card
          pad={12}
          bg={HG.mint}
          style={{ marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 22 }}>🛡️</Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONT.bodySemi,
              fontSize: 12,
              lineHeight: 17,
              color: HG.ink,
            }}
          >
            {t('Submitting anonymously. No login needed.', 'Odesíláte anonymně. Bez přihlášení.')}
          </Text>
        </Card>

        {error && (
          <Card pad={12} bg={HG.redSoft} style={{ marginTop: 14 }}>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: HG.ink }}>
              {error}
            </Text>
          </Card>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
          flexDirection: 'row',
          gap: 10,
          borderTopWidth: 1.5,
          borderColor: HG.ink,
          backgroundColor: HG.cream,
        }}
      >
        <Btn onPress={() => router.back()} bg={HG.card}>
          {t('← Back', '← Zpět')}
        </Btn>
        <Btn
          primary
          full
          bg={HG.red}
          color={HG.cream}
          onPress={onSend}
        >
          {submitting ? <ActivityIndicator color={HG.cream} /> : t('Send tip →', 'Odeslat →')}
        </Btn>
      </View>
    </ReporterShell>
  );
}
