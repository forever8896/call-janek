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
import { useT } from '@/lib/i18n';
import { toUIRow } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import type { ReportListItem } from '@/lib/types';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

type StatusTab = 'ready' | 'actioned' | 'archived';

// Coalesce Realtime bursts so a 150-report flood doesn't fan out into 150 fetches.
const REALTIME_DEBOUNCE_MS = 400;

function tabLabelCz(tab: StatusTab): string {
  return tab === 'ready' ? 'OTEVŘENÉ' : tab === 'actioned' ? 'ŘEŠENÉ' : 'ARCHIV';
}

// Android needs this opt-in for LayoutAnimation to fire.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminQueue() {
  const router = useRouter();
  const { role, isReady } = useAuth();
  const t = useT();
  const TABS: { label: string; value: StatusTab }[] = [
    { label: t('Open', 'Otevřené'), value: 'ready' },
    { label: t('Actioned', 'Řešené'), value: 'actioned' },
    { label: t('Archived', 'Archiv'), value: 'archived' },
  ];
  const [tab, setTab] = useState<StatusTab>('ready');
  const [sort, setSort] = useState<'urgency' | 'time'>('urgency');
  const [spamMode, setSpamMode] = useState(false);
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
      const res = await getAdminQueue({
        status: spamMode ? 'spam' : tab,
        sort,
        limit: 50,
      });
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
  }, [tab, sort, spamMode, role]);

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

  // Manual refresh button: spins the icon on tap as tactile feedback that the
  // request fired, even before the network roundtrip lands.
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const onTapRefresh = useCallback(() => {
    refreshSpin.setValue(0);
    Animated.timing(refreshSpin, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
    onRefresh();
  }, [refreshSpin, onRefresh]);

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
          title={t('Queue', 'Fronta')}
          subtitle={`${total} ${
            spamMode
              ? t('SPAM', 'SPAM')
              : t(tab.toUpperCase(), tabLabelCz(tab))
          } · ${reports.length} ${t('SHOWN', 'ZOBRAZENO')}`}
          right={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={onTapRefresh}
                hitSlop={6}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: HG.card,
                  borderWidth: BORDER.half,
                  borderColor: HG.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.Text
                  style={{
                    fontFamily: FONT.bodyBold,
                    color: HG.ink,
                    transform: [
                      {
                        rotate: refreshSpin.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }}
                >
                  ↻
                </Animated.Text>
              </Pressable>
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
                {t('This morning', 'Dnes ráno')}
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
                <Text style={{ color: HG.red }}>{critical} {t('critical', 'kritických')}</Text> · {high} {t('high', 'vysokých')} · {newCount} {t('new', 'nových')}
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
          {/* Sort toggle: Naléhavost / Čas */}
          <View
            style={{
              flexDirection: 'row',
              gap: 4,
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              borderRadius: 999,
              padding: 2,
            }}
          >
            {(['urgency', 'time'] as const).map((s) => {
              const active = sort === s;
              const label =
                s === 'urgency'
                  ? t('Naléhavost ↓', 'Naléhavost ↓')
                  : t('Time ↓', 'Čas ↓');
              return (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  hitSlop={4}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: active ? HG.ink : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT.bodyBold,
                      fontSize: 11,
                      color: active ? HG.cream : HG.ink,
                      letterSpacing: 0.2,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Spam toggle */}
          <Pressable
            onPress={() => setSpamMode((v) => !v)}
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              borderWidth: BORDER.half,
              borderColor: HG.ink,
              backgroundColor: spamMode ? HG.red : 'transparent',
            }}
          >
            {!spamMode && (
              <Animated.View
                style={{
                  width: 6,
                  height: 6,
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
            )}
            <Text
              style={{
                fontFamily: FONT.bodyBold,
                fontSize: 10,
                color: spamMode ? HG.cream : HG.ink,
                letterSpacing: 0.6,
              }}
            >
              {t('SPAM', 'SPAM')}
            </Text>
          </Pressable>
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
                {t('Nothing in the queue.\nYou’re all caught up.', 'Fronta je prázdná.\nMáš to splněno.')}
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
              {t('— END · KEEP UP THE GOOD WORK —', '— KONEC · PĚKNÁ PRÁCE —')}
            </Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
