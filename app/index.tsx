import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Chip } from '@/components/atoms';
import {
  IllExchange,
  IllPragueSkyline,
  IllTaxi,
  IllTrdelnik,
} from '@/components/illustrations';
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
        <View style={{ position: 'relative', height: 220, marginTop: 8 }}>
          <View style={{ position: 'absolute', bottom: 0, left: -24, right: -24, opacity: 0.5 }}>
            <IllPragueSkyline width={450} height={90} />
          </View>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: -10,
              transform: [{ rotate: '-8deg' }],
            }}
          >
            <IllTrdelnik size={92} />
          </View>
          <View
            style={{
              position: 'absolute',
              top: 30,
              right: -8,
              transform: [{ rotate: '6deg' }],
            }}
          >
            <IllTaxi size={100} />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 60,
              left: 90,
              transform: [{ rotate: '-4deg' }],
            }}
          >
            <IllExchange size={84} />
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <Chip bg={HG.red} color={HG.cream} sm>
            ● HONEST GUIDE
          </Chip>
        </View>

        <Text
          style={{
            fontFamily: FONT.displaySemi,
            fontSize: 42,
            lineHeight: 42,
            marginTop: 10,
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
