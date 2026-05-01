import { Stack } from 'expo-router';

export default function AdminLayout() {
  // TODO: gate the entire group on admin auth here. Until signed in,
  // redirect to ./sign-in. Reporter sessions must never reach this layout.
  return (
    <Stack>
      <Stack.Screen name="sign-in" options={{ title: 'Admin sign in' }} />
      <Stack.Screen name="queue" options={{ title: 'Reports' }} />
    </Stack>
  );
}
