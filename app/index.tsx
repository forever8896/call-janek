import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { PRAGUE_BG, PragueScroll } from '@/components/prague-scroll';
import { useLang, useT } from '@/lib/i18n';
import { BORDER, FONT, HG, RADIUS } from '@/theme/tokens';

export default function Splash() {
  const router = useRouter();
  const t = useT();
  const { lang, toggle } = useLang();

  return (
    <View style={{ flex: 1, backgroundColor: PRAGUE_BG }}>
      {/* Skyline runs edge-to-edge from the top of the screen, no cropping. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRAGUE_BG }}>
        <PragueScroll height={160} opacity={1} speedPxPerSec={22} />

        {/* Floating EN/CZ switcher in the top-right corner */}
        <Pressable
          onPress={toggle}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: HG.butter,
            borderWidth: BORDER.half,
            borderColor: HG.ink,
            borderRadius: RADIUS.pill,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.bodyBold,
              fontSize: 12,
              color: HG.ink,
              letterSpacing: 0.5,
            }}
          >
            {lang} ↔
          </Text>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          {/* Characters live below the skyline */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 8,
              gap: -12,
            }}
          >
            <Mascot kind="trdelnik_mogger" size={140} bobble rotate={-6} delay={0} />
            <Mascot kind="angry_sunka" size={130} bobble rotate={5} delay={500} />
          </View>

          <Text
            style={{
              fontFamily: FONT.displaySemi,
              fontSize: 42,
              lineHeight: 42,
              marginTop: 22,
              letterSpacing: -1,
              color: HG.ink,
            }}
          >
            {lang === 'CZ' ? (
              <>
                Okradli vás{' '}
                <Text
                  style={{
                    fontFamily: FONT.displaySemiItalic,
                    color: HG.red,
                  }}
                >
                  v Praze?
                </Text>
              </>
            ) : (
              <>
                Got{' '}
                <Text
                  style={{
                    fontFamily: FONT.displaySemiItalic,
                    color: HG.red,
                  }}
                >
                  scammed
                </Text>{' '}
                in Prague?
              </>
            )}
          </Text>

          <Text
            style={{
              fontFamily: FONT.bodySemi,
              fontSize: 16,
              lineHeight: 23,
              color: HG.inkSoft,
              marginTop: 12,
            }}
          >
            {t(
              'Tap, talk, send. Janek’s team reads every tip and goes after the bad ones — taxi meters, exchange booths, trdelník traps, the works.',
              'Klepni, řekni, pošli. Janekův tým čte každý tip a jde po těch zlých — taxametry, směnárny, trdelníky, prostě všechno.',
            )}
          </Text>

          <View style={{ flex: 1, minHeight: 24 }} />

          <View style={{ gap: 10 }}>
            <Btn primary full onPress={() => router.push('/(reporter)')}>
              {t('Report a scam →', 'Nahlásit podvod →')}
            </Btn>
            <Pressable
              onPress={() => router.push('/(admin)/sign-in')}
              style={{ paddingVertical: 8, alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: FONT.bodySemi,
                  fontSize: 12,
                  color: HG.inkMute,
                }}
              >
                {t('I’m Janek · sign in to newsroom', 'Jsem Janek · přihlásit do redakce')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
