import { Stack } from 'expo-router';
import { HG } from '@/theme/tokens';

export default function ReporterLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: HG.cream },
      }}
    />
  );
}
