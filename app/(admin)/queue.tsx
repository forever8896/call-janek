import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AdminQueue() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Reports</ThemedText>
      <ThemedText>
        Triaged, deduplicated, urgency-sorted. Tap a card for full context,
        attached evidence, and similar prior reports.
      </ThemedText>

      {/* TODO: list of post-pipeline reports from the backend. Group by
          category, sort by urgency. Only show reports that cleared spam +
          dedupe. */}
      <ThemedText type="defaultSemiBold">[ Queue list placeholder ]</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
});
