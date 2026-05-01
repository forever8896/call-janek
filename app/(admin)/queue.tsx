import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminHeader, HeaderIconBtn } from '@/components/admin/Header';
import { QueueRow } from '@/components/admin/QueueRow';
import { Mascot, categoryMascot } from '@/components/mascot';
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

// Coalesce Realtime bursts so a 150-report flood doesn't fan out into 150 fetches.
const REALTIME_DEBOUNCE_MS = 400;

// Android needs this opt-in for LayoutAnimation to fire.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminQueue() {
  const router = useRouter();
  const { role, isReady } = useAuth();
  const [tab, setTab] = useState<StatusTab>('ready');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulse animation fires every time a Realtime event arrives so Janek can
  // see the queue is live even before the next debounced fetch lands.
  const pulse = useRef(new Animated.Value(0)).current;
  const flashLive = useCallback(() => {
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }).start();
  }, [pulse]);

  const load = useCallback(async () => {
    if (role !== 'admin') return;
    try {
      const res = await getAdminQueue({ status: tab, limit: 50 });
      // Smooth reorder/insert/remove transitions when the list shape changes.
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  // Realtime: debounce a flood of inserts/updates into a single refetch so
  // 150 events in 60s don't trigger 150 round-trips. Pulse on every event
  // for liveness feedback even between fetches.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (role !== 'admin') return;
    const channel = supabase
      .channel('admin-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          flashLive();
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            load();
          }, REALTIME_DEBOUNCE_MS);
        },
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [load, role, flashLive]);

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
            {(() => {
              const top = [...reports]
                .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))[0];
              const mk = top ? categoryMascot(top.category, 'high') : null;
              return <Mascot kind={mk ?? 'angry_sunka'} size={64} bobble rotate={-4} />;
            })()}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Animated.View
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: HG.red,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                transform: [
                  {
                    scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }),
                  },
                ],
              }}
            />
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
