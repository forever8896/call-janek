import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';
import { BORDER, FONT, HG, RADIUS } from '@/theme/tokens';

export default function AdminSignIn() {
  const router = useRouter();
  const t = useT();
  const { lang, toggle } = useLang();
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
      setError(t('Email and password required.', 'Email a heslo povinné.'));
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
          <Mascot kind="janek" size={56} />
          <View style={{ flex: 1 }}>
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
              {t('NEWSROOM', 'REDAKCE')}
            </Text>
          </View>
          <Pressable
            onPress={toggle}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: HG.butter,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              borderRadius: RADIUS.pill,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bodyBold,
                fontSize: 11,
                color: HG.ink,
                letterSpacing: 0.5,
              }}
            >
              {lang} ↔
            </Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Mascot kind="janek" size={180} bobble />
          <Text
            style={{
              fontFamily: FONT.displaySemi,
              fontSize: 36,
              lineHeight: 38,
              letterSpacing: -0.5,
              marginTop: 16,
              textAlign: 'center',
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
              textAlign: 'center',
            }}
          >
            {t(
              'Sign in once and we’ll keep you in. Face ID will unlock the queue next time you open the app.',
              'Přihlas se jednou a zůstaneš. Face ID otevře frontu při příštím spuštění.',
            )}
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
              {t('Email', 'Email')}
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
              {t('Password', 'Heslo')}
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
                {t(
                  'Unlock with Face ID / fingerprint next time',
                  'Příště otevřít přes Face ID / otisk',
                )}
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
            {submitting ? t('Signing in…', 'Přihlašuji…') : t('Sign in →', 'Přihlásit →')}
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
          {t('ALL ACTIONS LOGGED · CZ HOSTED', 'AKCE LOGOVÁNY · HOSTOVÁNO V ČR')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
