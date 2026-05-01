import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { JanekAvatar } from '@/components/illustrations';
import { useAuth } from '@/lib/auth';
import { BORDER, FONT, HG } from '@/theme/tokens';

export default function AdminSignIn() {
  const router = useRouter();
  const { role, isReady, signInAdmin } = useAuth();
  const [email, setEmail] = useState('janek@honestguide.cz');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in as admin, hop straight to the queue.
  useEffect(() => {
    if (isReady && role === 'admin') {
      router.replace('/(admin)/queue');
    }
  }, [isReady, role, router]);

  const onSend = async () => {
    setError(null);
    setSending(true);
    const { error: err } = await signInAdmin(email.trim());
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 30,
          paddingBottom: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <JanekAvatar size={48} />
          <View>
            <Text
              style={{
                fontFamily: FONT.displaySemiItalic,
                fontSize: 18,
                color: HG.ink,
              }}
            >
              Honest Guide
            </Text>
            <Text
              style={{
                fontFamily: FONT.monoBold,
                fontSize: 10,
                color: HG.inkMute,
                letterSpacing: 0.5,
              }}
            >
              NEWSROOM
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: FONT.displaySemi,
              fontSize: 36,
              lineHeight: 38,
              letterSpacing: -0.5,
              color: HG.ink,
            }}
          >
            Ahoj <Text style={{ fontFamily: FONT.displaySemiItalic, color: HG.redInk }}>Janku</Text>.
          </Text>
          <Text
            style={{
              fontFamily: FONT.bodySemi,
              fontSize: 14,
              color: HG.inkMute,
              marginTop: 12,
              lineHeight: 21,
            }}
          >
            {sent
              ? 'Magic link on its way. Tap it on this device to come back signed in.'
              : 'We email you a one-time link. Tap it on this phone and you’re in.'}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: HG.card,
              borderWidth: BORDER.full,
              borderColor: HG.ink,
              borderRadius: 14,
            }}
          >
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={HG.inkMute}
              style={{
                fontFamily: FONT.monoBold,
                fontSize: 13,
                color: HG.ink,
                padding: 0,
              }}
              editable={!sending && !sent}
            />
          </View>

          {error && (
            <Text
              style={{
                fontFamily: FONT.monoBold,
                fontSize: 11,
                color: HG.red,
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          )}

          <Btn
            primary
            full
            bg={HG.amberSoft}
            color={HG.ink}
            onPress={onSend}
          >
            {sending ? 'Sending…' : sent ? 'Resend magic link' : 'Send magic link →'}
          </Btn>
        </View>

        <Text
          style={{
            marginTop: 18,
            fontFamily: FONT.monoBold,
            fontSize: 9,
            color: HG.inkDim,
            letterSpacing: 0.6,
            textAlign: 'center',
          }}
        >
          PASSWORDLESS · ALL ACTIONS LOGGED · CZ HOSTED
        </Text>
      </View>
    </SafeAreaView>
  );
}
