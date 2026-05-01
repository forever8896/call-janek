import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Btn, Card } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { useT } from '@/lib/i18n';
import { BORDER, FONT, HG } from '@/theme/tokens';

export default function Offline() {
  const router = useRouter();
  const t = useT();

  const rows: Array<[string, string, string]> = [
    ['🎙', '1 ' + t('recording', 'nahrávka'), '0:47'],
    ['📷', '2 ' + t('photos', 'fotky'), '1.4 MB'],
    ['↻', t('Queued for upload', 'Ve frontě'), '—'],
  ];

  return (
    <ReporterShell bg={HG.butter}>
      <ReporterTopBar title={t('● Offline — saved', '● Offline — uloženo')} />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          justifyContent: 'center',
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={{ position: 'relative' }}>
            <Mascot kind="sad_tourist" size={200} bobble />
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                backgroundColor: HG.red,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: BORDER.half,
                borderColor: HG.ink,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.bodyBold,
                  fontSize: 12,
                  color: HG.cream,
                }}
              >
                1
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={{
            fontFamily: FONT.displaySemi,
            fontSize: 30,
            letterSpacing: -0.5,
            lineHeight: 32,
            color: HG.ink,
          }}
        >
          {t('Your tip is safe.', 'Tvůj tip je v bezpečí.')}
        </Text>
        <Text
          style={{
            fontFamily: FONT.bodySemi,
            fontSize: 14,
            color: HG.inkSoft,
            marginTop: 10,
            lineHeight: 20,
          }}
        >
          {t(
            'Saved on this phone. We’ll send it the moment you’re online — no action needed.',
            'Uloženo v telefonu. Odešleme, jakmile budeš online — bez akce.',
          )}
        </Text>

        <Card pad={14} bg={HG.cream} style={{ marginTop: 18 }}>
          {rows.map((r, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 6,
                borderTopWidth: i > 0 ? 1 : 0,
                borderColor: HG.rule,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontFamily: FONT.bodySemi, fontSize: 13, color: HG.ink }}>
                  {r[0]}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.bodySemi,
                    fontSize: 13,
                    color: i === 2 ? HG.red : HG.ink,
                  }}
                >
                  {r[1]}
                </Text>
              </View>
              <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: HG.inkMute }}>{r[2]}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 }}>
        <Btn primary full onPress={() => router.replace('/(reporter)')}>
          {t('Try sending now', 'Zkusit odeslat')}
        </Btn>
      </View>
    </ReporterShell>
  );
}
