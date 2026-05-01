import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { RecordButton } from '@/components/reporter/RecordButton';
import { CatIll, CatKey } from '@/components/illustrations';
import { useT } from '@/lib/i18n';
import { BORDER, FONT, HG, RADIUS, hardShadow } from '@/theme/tokens';

const CATS: Array<[CatKey, string, string, string, string]> = [
  ['taxi', 'Taxi', 'Taxi', HG.amberSoft, ''],
  ['exchange', 'Exchange', 'Směnárna', HG.lilac, ''],
  ['menu', 'Menu', 'Menu', HG.rose, ''],
  ['online', 'Online', 'Online', HG.mint, ''],
  ['pickpocket', 'Pickpocket', 'Kapsář', HG.sky, ''],
];

export default function ReporterHome() {
  const router = useRouter();
  const t = useT();
  return (
    <ReporterShell>
      <ReporterTopBar title={t('Tip line · Praha', 'Tipová linka · Praha')} />

      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        <Text
          style={{
            fontFamily: FONT.displaySemi,
            fontSize: 30,
            lineHeight: 32,
            letterSpacing: -0.6,
            color: HG.ink,
          }}
        >
          {t('What happened?', 'Co se stalo?')}
        </Text>
        <Text
          style={{
            fontFamily: FONT.bodySemi,
            fontSize: 14,
            color: HG.inkSoft,
            marginTop: 6,
            lineHeight: 20,
          }}
        >
          {t('Just talk. We’ll write it down for you.', 'Stačí mluvit. My to za vás zapíšeme.')}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <RecordButton onPress={() => router.push('/(reporter)/recording')} />
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text
          style={{
            fontFamily: FONT.bodyBold,
            fontSize: 11,
            color: HG.inkMute,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 8,
          }}
        >
          {t('Common in Prague', 'Časté v Praze')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {CATS.map(([cat, en, cz, bg]) => (
            <View
              key={cat}
              style={[
                {
                  width: 86,
                  paddingTop: 10,
                  paddingBottom: 8,
                  paddingHorizontal: 6,
                  backgroundColor: bg,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  borderRadius: 14,
                  alignItems: 'center',
                  gap: 2,
                },
                hardShadow(2),
              ]}
            >
              <CatIll cat={cat} size={42} />
              <Text
                style={{
                  fontFamily: FONT.bodyBold,
                  fontSize: 11,
                  color: HG.ink,
                }}
              >
                {t(en, cz)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 28,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.push('/(reporter)/review')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: HG.card,
            borderWidth: BORDER.half,
            borderColor: HG.ink,
            borderRadius: RADIUS.pill,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: FONT.bodyBold, fontSize: 13, color: HG.ink }}>
            {t('Type instead', 'Napsat')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(reporter)/past')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: HG.card,
            borderWidth: BORDER.half,
            borderColor: HG.ink,
            borderRadius: RADIUS.pill,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: FONT.bodyBold, fontSize: 13, color: HG.ink }}>
            {t('My tips', 'Moje tipy')}
          </Text>
        </Pressable>
      </View>
    </ReporterShell>
  );
}
