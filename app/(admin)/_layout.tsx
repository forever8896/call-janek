import { Stack } from 'expo-router';
import { HG } from '@/theme/tokens';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: HG.sand },
      }}
    />
  );
}
