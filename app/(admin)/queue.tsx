import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminHeader, HeaderIconBtn } from '@/components/admin/Header';
import { QueueRow } from '@/components/admin/QueueRow';
import { IllTaxi } from '@/components/illustrations';
import { getAdminQueue, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toUIRow } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import type { ReportListItem } from '@/lib/types';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

type StatusTab = 'ready' | 'actioned' | 'archived';

const TABS: { label: string; value: StatusTab }[] = [
  { label: 'Open', value: 'ready' },
  { label: 'Actioned', value: 'actioned' },
  { label: 'Archived', value: 'archived' },
];

export default function AdminQueue() {
  const router = useRouter();
  const { role, isReady } = useAuth();
  const [tab, setTab] = useState<StatusTab>('ready');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role !== 'admin') return;
    try {
      const res = await getAdminQueue({ status: tab, limit: 50 });
      setReports(res.reports);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, role]);

  // Redirect non-admins to sign in
  useEffect(() => {
    if (isReady && role !== 'admin') {
      router.replace('/(admin)/sign-in');
    }
  }, [isReady, role, router]);

  // Initial fetch + on filter change
  useEffect(() => {
    load();
  }, [load]);

  // Refetch on tab focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: any reports row going to status='ready' triggers a re-fetch
  useEffect(() => {
    if (role !== 'admin') return;
    const channel = supabase
      .channel('admin-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, role]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const critical = reports.filter((r) => (r.urgency_score ?? 0) >= 9).length;
  const high = reports.filter((r) => {
    const s = r.urgency_score ?? 0;
    return s >= 7 && s < 9;
  }).length;
  const newCount = reports.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader
          title="Queue"
          subtitle={`${total} ${tab.toUpperCase()} · ${reports.length} SHOWN`}
          right={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <HeaderIconBtn onPress={() => router.push('/(admin)/search')}>⌕</HeaderIconBtn>
              <HeaderIconBtn onPress={() => router.push('/(admin)/settings')}>≡</HeaderIconBtn>
            </View>
          }
        />

        {/* Digest band */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View
            style={[
              {
                backgroundColor: HG.amberSoft,
                borderWidth: BORDER.full,
                borderColor: HG.ink,
                borderRadius: 14,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              },
              hardShadow(3),
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONT.bodyBold,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: HG.inkMute,
                }}
              >
                This morning
              </Text>
              <Text
                style={{
                  fontFamily: FONT.displaySemiItalic,
                  fontSize: 18,
                  marginTop: 2,
                  lineHeight: 22,
                  color: HG.ink,
                }}
              >
                <Text style={{ color: HG.red }}>{critical} critical</Text> · {high} high · {newCount} new
              </Text>
            </View>
            <View style={{ transform: [{ rotate: '-6deg' }] }}>
              <IllTaxi size={48} />
            </View>
          </View>
        </View>

        {/* Status tabs */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {TABS.map(({ label, value }) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  borderRadius: 999,
                  backgroundColor: active ? HG.ink : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.bodyBold,
                    fontSize: 12,
                    color: active ? HG.cream : HG.ink,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: FONT.monoBold,
              fontSize: 10,
              color: HG.inkDim,
              letterSpacing: 0.4,
            }}
          >
            SORTED · URGENCY ↓
          </Text>
          <Text
            style={{
              fontFamily: FONT.monoBold,
              fontSize: 10,
              color: HG.inkDim,
              letterSpacing: 0.4,
            }}
          >
            LIVE
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
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
          {!loading && !error && reports.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: FONT.displayItalic,
                  fontSize: 16,
                  color: HG.inkMute,
                  textAlign: 'center',
                }}
              >
                Nothing in the queue.{'\n'}You&apos;re all caught up.
              </Text>
            </View>
          )}
          {reports.map((item) => (
            <QueueRow
              key={item.id}
              item={toUIRow(item)}
              onPress={() => router.push(`/(admin)/detail?id=${item.id}`)}
            />
          ))}
          {reports.length > 0 && (
            <Text
              style={{
                padding: 20,
                textAlign: 'center',
                fontFamily: FONT.monoBold,
                fontSize: 10,
                color: HG.inkDim,
                letterSpacing: 0.6,
              }}
            >
              — END · KEEP UP THE GOOD WORK —
            </Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
