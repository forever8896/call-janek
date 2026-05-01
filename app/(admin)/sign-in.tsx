import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AdminSignIn() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Admin sign in</ThemedText>
      <ThemedText>Restricted to Janek.</ThemedText>

      {/* TODO: real auth (passkey / magic link / OAuth). Issue an admin-scoped
          token, persist, then route to /queue. */}
      <Link href="/(admin)/queue">
        <ThemedText type="link">[ stub ] Continue to queue</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: 'center',
  },
});
