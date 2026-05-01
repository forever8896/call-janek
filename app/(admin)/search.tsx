import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/atoms';
import { AdminHeader } from '@/components/admin/Header';
import { QueueRow } from '@/components/admin/QueueRow';
import { ApiError, getAdminQueue } from '@/lib/api';
import { toUIRow } from '@/lib/mapping';
import type { Category, ReportListItem } from '@/lib/types';
import { BORDER, FONT, HG } from '@/theme/tokens';

const FACETS: { label: string; cat: Category | null }[] = [
  { label: 'All', cat: null },
  { label: 'Taxi', cat: 'taxi_scam' },
  { label: 'Exchange', cat: 'fake_exchange' },
  { label: 'Restaurant', cat: 'restaurant_scam' },
  { label: 'Online', cat: 'online_fraud' },
];

export default function AdminSearch() {
  const router = useRouter();
  const [cat, setCat] = useState<Category | null>(null);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getAdminQueue({ category: cat ?? undefined, limit: 50 });
        if (!cancelled) setReports(res.reports);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cat]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader title="Search" subtitle="ALL TIME" onBack={() => router.back()} />

        <View style={{ padding: 14, borderBottomWidth: 1.5, borderColor: HG.rule }}>
          <View
            style={{
              backgroundColor: HG.card,
              borderWidth: BORDER.full,
              borderColor: HG.ink,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ color: HG.inkMute, fontFamily: FONT.bodyBold }}>⌕</Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 13, color: HG.ink, flex: 1 }}>
              {cat ? `category:${cat}` : 'all reports'}
            </Text>
            <Chip bg={HG.amberSoft} sm>
              {reports.length} hits
            </Chip>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {FACETS.map((f) => {
              const active = f.cat === cat;
              return (
                <Pressable key={f.label} onPress={() => setCat(f.cat)}>
                  <Chip sm bg={active ? HG.ink : HG.lilac} color={active ? HG.cream : HG.ink}>
                    {f.label}
                  </Chip>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {loading && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <ActivityIndicator color={HG.ink} />
            </View>
          )}
          {error && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT.monoBold, fontSize: 12, color: HG.red }}>
                {error}
              </Text>
            </View>
          )}
          {!loading &&
            !error &&
            reports.map((item) => (
              <QueueRow
                key={item.id}
                item={toUIRow(item)}
                onPress={() => router.push(`/(admin)/detail?id=${item.id}`)}
              />
            ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
