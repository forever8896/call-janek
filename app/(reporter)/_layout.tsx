import { Stack } from 'expo-router';

export default function ReporterLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Report a problem' }} />
    </Stack>
  );
}
