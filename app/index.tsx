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
        {/* Hero illustration */}
        <View style={{ position: 'relative', height: 240, marginTop: 8 }}>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: -24,
              right: -24,
            }}
          >
            <PragueScroll height={110} opacity={0.55} speedPxPerSec={16} />
          </View>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: -16,
            }}
          >
            <Mascot kind="trdelnik_mogger" size={150} bobble rotate={-8} delay={0} />
          </View>
          <View
            style={{
              position: 'absolute',
              top: 50,
              right: -10,
            }}
          >
            <Mascot kind="exchange_scammer" size={140} bobble rotate={6} delay={400} />
          </View>
          <View
            style={{
              position: 'absolute',
              top: 80,
              left: 90,
            }}
          >
            <Mascot kind="angry_sunka" size={110} bobble rotate={-3} delay={800} />
          </View>
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
