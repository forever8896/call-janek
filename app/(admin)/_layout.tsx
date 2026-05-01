import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BiometricGate } from '@/components/admin/BiometricGate';
import { useAuth } from '@/lib/auth';
import { HG } from '@/theme/tokens';

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, role, biometricEnabled, biometricUnlocked } = useAuth();

  const onSignIn = pathname === '/(admin)/sign-in' || pathname === '/sign-in';

  // Push non-admins to the sign-in screen
  useEffect(() => {
    if (!isReady) return;
    if (role !== 'admin' && !onSignIn) {
      router.replace('/(admin)/sign-in');
    }
  }, [isReady, role, onSignIn, router]);

  if (!isReady) {
    return (
      <View
        style={{ flex: 1, backgroundColor: HG.sand, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={HG.ink} />
      </View>
    );
  }

  // Admin session restored but hasn't unlocked this run → biometric gate.
  // Sign-in screen is exempt so the user can sign out from a stuck state.
  if (role === 'admin' && biometricEnabled && !biometricUnlocked && !onSignIn) {
    return <BiometricGate />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: HG.sand },
      }}
    />
  );
}
