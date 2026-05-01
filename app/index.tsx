import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { PragueScroll } from '@/components/prague-scroll';
import { FONT, HG } from '@/theme/tokens';

export default function Splash() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.cream }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 50,
          paddingBottom: 24,
        }}
      >
        {/* Skyline (4x scale, bottom-clipped so empty cream top falls off) */}
        <View style={{ position: 'relative', height: 220, marginTop: 8, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: -24,
              right: -24,
              height: 440,
              justifyContent: 'flex-end',
            }}
          >
            <PragueScroll height={440} opacity={0.55} speedPxPerSec={28} />
          </View>
        </View>

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
  );
}
