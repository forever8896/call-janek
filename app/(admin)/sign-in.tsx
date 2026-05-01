import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { JanekAvatar } from '@/components/illustrations';
import { useAuth } from '@/lib/auth';
import { BORDER, FONT, HG } from '@/theme/tokens';

export default function AdminSignIn() {
  const router = useRouter();
  const {
    role,
    isReady,
    biometricSupported,
    biometricEnabled,
    biometricUnlocked,
    setBiometricEnabled,
    signInWithPassword,
  } = useAuth();

  const [email, setEmail] = useState('janek@honestguide.cz');
  const [password, setPassword] = useState('');
  const [enableBiometric, setEnableBiometric] = useState(biometricEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in + biometric unlocked → go to queue
  useEffect(() => {
    if (isReady && role === 'admin' && biometricUnlocked) {
      router.replace('/(admin)/queue');
    }
  }, [isReady, role, biometricUnlocked, router]);

  // Reflect saved biometric pref into the toggle
  useEffect(() => {
    setEnableBiometric(biometricEnabled);
  }, [biometricEnabled]);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || password.length === 0) {
      setError('Email and password required.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await signInWithPassword(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }
    await setBiometricEnabled(enableBiometric && biometricSupported);
    setSubmitting(false);
    // Navigation handled by the effect above once role + biometric flip
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
            Ahoj{' '}
            <Text style={{ fontFamily: FONT.displaySemiItalic, color: HG.redInk }}>Janku</Text>.
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
            Sign in once and we&apos;ll keep you in. Face ID will unlock the queue next
            time you open the app.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: HG.card,
              borderWidth: BORDER.full,
              borderColor: HG.ink,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bodyBold,
                fontSize: 10,
                color: HG.inkMute,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              Email
            </Text>
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
              editable={!submitting}
            />
          </View>

          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: HG.card,
              borderWidth: BORDER.full,
              borderColor: HG.ink,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bodyBold,
                fontSize: 10,
                color: HG.inkMute,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor={HG.inkMute}
              style={{
                fontFamily: FONT.monoBold,
                fontSize: 13,
                color: HG.ink,
                padding: 0,
              }}
              editable={!submitting}
              onSubmitEditing={onSubmit}
            />
          </View>

          {biometricSupported && (
            <Pressable
              onPress={() => setEnableBiometric((v) => !v)}
              disabled={submitting}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  backgroundColor: enableBiometric ? HG.ink : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {enableBiometric && (
                  <Text style={{ color: HG.cream, fontFamily: FONT.bodyBold, fontSize: 14 }}>
                    ✓
                  </Text>
                )}
              </View>
              <Text style={{ fontFamily: FONT.bodySemi, fontSize: 13, color: HG.ink }}>
                Unlock with Face ID / fingerprint next time
              </Text>
            </Pressable>
          )}

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
            onPress={onSubmit}
          >
            {submitting ? 'Signing in…' : 'Sign in →'}
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
          ALL ACTIONS LOGGED · CZ HOSTED
        </Text>
      </View>
    </SafeAreaView>
  );
}
