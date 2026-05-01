import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { PRAGUE_BG, PragueScroll } from '@/components/prague-scroll';
import { FONT, HG } from '@/theme/tokens';

export default function Splash() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: PRAGUE_BG }}>
      {/* Skyline runs edge-to-edge from the top of the screen, no cropping. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRAGUE_BG }}>
        <PragueScroll height={160} opacity={1} speedPxPerSec={22} />
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
          Tap, talk, send. Janek&apos;s team reads every tip and goes after the bad ones — taxi
          meters, exchange booths, trdelník traps, the works.
        </Text>

        <View style={{ flex: 1, minHeight: 24 }} />

        <View style={{ gap: 10 }}>
          <Btn primary full onPress={() => router.push('/(reporter)')}>
            Report a scam →
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
              I&apos;m Janek · sign in to newsroom
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
