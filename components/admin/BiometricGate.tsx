import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Btn } from '@/components/atoms';
import { JanekAvatar } from '@/components/illustrations';
import { useAuth } from '@/lib/auth';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

// Shown when an admin session is restored but the device hasn't been
// proved-of-presence yet. Auto-prompts on mount; can be retried.
export function BiometricGate() {
  const { unlockWithBiometric, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);
  const promptedOnce = useRef(false);

  const prompt = async () => {
    setPrompting(true);
    setError(null);
    const { ok, error: err } = await unlockWithBiometric();
    setPrompting(false);
    if (!ok && err) setError(err);
  };

  useEffect(() => {
    if (promptedOnce.current) return;
    promptedOnce.current = true;
    prompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: HG.sand,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 24,
      }}
    >
      <View
        style={[
          {
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: HG.amberSoft,
            borderWidth: BORDER.full,
            borderColor: HG.ink,
            alignItems: 'center',
            justifyContent: 'center',
          },
          hardShadow(4),
        ]}
      >
        <JanekAvatar size={72} />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            fontFamily: FONT.displaySemiItalic,
            fontSize: 24,
            color: HG.ink,
            textAlign: 'center',
          }}
        >
          Unlock the newsroom
        </Text>
        <Text
          style={{
            fontFamily: FONT.bodySemi,
            fontSize: 13,
            color: HG.inkMute,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          Confirm it&apos;s you with Face ID, fingerprint, or device passcode.
        </Text>
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

      <View style={{ alignSelf: 'stretch', gap: 10 }}>
        <Btn primary full bg={HG.amberSoft} color={HG.ink} onPress={prompt}>
          {prompting ? 'Verifying…' : 'Unlock'}
        </Btn>
        <Pressable onPress={signOut} style={{ paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ fontFamily: FONT.bodySemi, fontSize: 13, color: HG.inkMute }}>
            Use a different account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
