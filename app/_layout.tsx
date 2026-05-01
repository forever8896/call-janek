import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useFraunces } from '@expo-google-fonts/fraunces';
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider } from '@/lib/auth';
import { LangProvider } from '@/lib/i18n';
import { HG } from '@/theme/tokens';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const [loaded] = useFraunces({
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: HG.cream }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LangProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: HG.cream },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(reporter)" />
            <Stack.Screen name="(admin)" />
          </Stack>
          <StatusBar style="dark" />
        </LangProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
