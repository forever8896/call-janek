import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ReporterHome() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Tell Janek what happened</ThemedText>
      <ThemedText>
        Tap the mic and describe the problem in your own words. We will turn
        your voice into a report and pass it to Janek.
      </ThemedText>

      {/* TODO: voice-first Whisper intake — record audio, transcribe, pre-fill form */}
      <ThemedText type="defaultSemiBold">[ Voice intake placeholder ]</ThemedText>

      <Link href="/(admin)/sign-in">
        <ThemedText type="link">Janek? Sign in</ThemedText>
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
