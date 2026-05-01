import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Btn, Card, Chip, Hairline, Urgency } from '@/components/atoms';
import { Mascot } from '@/components/mascot';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { useT } from '@/lib/i18n';
import { shortId } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import type { ReportStatus, Category } from '@/lib/types';
import { FONT, HG } from '@/theme/tokens';

const CAT_LABEL_EN: Record<Category, string> = {
  taxi_scam: 'Taxi scam',
  fake_exchange: 'Fake exchange',
  online_fraud: 'Online fraud',
  restaurant_scam: 'Restaurant scam',
  other: 'Other',
};
const CAT_LABEL_CZ: Record<Category, string> = {
  taxi_scam: 'Taxi podvod',
  fake_exchange: 'Falešná směnárna',
  online_fraud: 'Online podvod',
  restaurant_scam: 'Podvod v restauraci',
  other: 'Jiné',
};

const STATUS_LABEL_EN: Record<ReportStatus, string> = {
  queued: 'Queued',
  transcribing: 'Transcribing',
  processing: 'Processing',
  ready: 'Ready for Janek',
  spam: 'Filtered',
  quarantine: 'Held for review',
  archived: 'Archived',
  actioned: 'Actioned',
};
const STATUS_LABEL_CZ: Record<ReportStatus, string> = {
  queued: 'Ve frontě',
  transcribing: 'Přepisuji',
  processing: 'Zpracovávám',
  ready: 'Pro Janka',
  spam: 'Filtrováno',
  quarantine: 'V karanténě',
  archived: 'Archivováno',
  actioned: 'Řešeno',
};

function ConfirmHero() {
  const scale = useSharedValue(0.4);
  const sparkleA = useSharedValue(0);
  const sparkleB = useSharedValue(0);
  const sparkleC = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 110 });
    const twinkle = (sv: typeof sparkleA, delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          true,
        ),
      );
    sparkleA.value = twinkle(sparkleA, 200);
    sparkleB.value = twinkle(sparkleB, 600);
    sparkleC.value = twinkle(sparkleC, 1000);
  }, [scale, sparkleA, sparkleB, sparkleC]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const sA = useAnimatedStyle(() => ({ opacity: sparkleA.value }));
  const sB = useAnimatedStyle(() => ({ opacity: sparkleB.value }));
  const sC = useAnimatedStyle(() => ({ opacity: sparkleC.value }));

  return (
    <View
      style={{
        marginTop: 20,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={heroStyle}>
        <Mascot kind="trdelnik_soyboy" size={170} bobble />
      </Animated.View>
      <Animated.Text style={[{ position: 'absolute', top: 10, left: 30, fontSize: 26 }, sA]}>
        ✦
      </Animated.Text>
      <Animated.Text style={[{ position: 'absolute', top: 38, right: 30, fontSize: 22 }, sB]}>
        ✦
      </Animated.Text>
      <Animated.Text style={[{ position: 'absolute', bottom: 16, right: 70, fontSize: 18 }, sC]}>
        ✦
      </Animated.Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontFamily: FONT.bodySemi, fontSize: 12, color: HG.inkMute }}>{label}</Text>
      {value}
    </View>
  );
}

function urgencyBucket(score: number | null): 1 | 2 | 3 | 4 {
  if (!score) return 1;
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  return 1;
}

export default function Confirm() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [status, setStatus] = useState<ReportStatus>('queued');
  const [category, setCategory] = useState<Category | null>(null);
  const [urgency, setUrgency] = useState<number | null>(null);
  const [clusterId, setClusterId] = useState<string | null>(null);
  const [clusterCount, setClusterCount] = useState<number>(0);

  // Initial fetch
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('reports')
        .select('status, category, urgency_score, cluster_id')
        .eq('id', id)
        .single();
      if (cancelled || !data) return;
      setStatus(data.status as ReportStatus);
      setCategory(data.category as Category | null);
      setUrgency(data.urgency_score);
      setClusterId(data.cluster_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Realtime subscription on this report's row
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`report-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as {
            status: ReportStatus;
            category: Category | null;
            urgency_score: number | null;
            cluster_id: string | null;
          };
          setStatus(row.status);
          setCategory(row.category);
          setUrgency(row.urgency_score);
          setClusterId(row.cluster_id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Cluster size
  useEffect(() => {
    if (!clusterId) {
      setClusterCount(0);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('report_clusters')
        .select('report_count')
        .eq('id', clusterId)
        .single();
      if (data) setClusterCount(data.report_count);
    })();
  }, [clusterId]);

  const statusLabel = (t('en', 'cz') === 'cz' ? STATUS_LABEL_CZ : STATUS_LABEL_EN)[status];
  const catLabels = t('en', 'cz') === 'cz' ? CAT_LABEL_CZ : CAT_LABEL_EN;
  const isReady = status === 'ready' || status === 'actioned';

  return (
    <ReporterShell bg={HG.mint}>
      <ReporterTopBar title={t('Tip received ✓', 'Tip přijat ✓')} />

      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <ConfirmHero />

        <Text
          style={{
            fontFamily: FONT.displaySemi,
            fontSize: 32,
            lineHeight: 34,
            letterSpacing: -0.5,
            marginTop: 12,
            color: HG.ink,
          }}
        >
          {t('Thanks. Your tip is in.', 'Díky. Tip je u nás.')}
        </Text>
        <Text
          style={{
            fontFamily: FONT.bodySemi,
            fontSize: 14,
            color: HG.inkSoft,
            marginTop: 10,
            lineHeight: 20,
          }}
        >
          {isReady
            ? t(
                'Janek’s team is on it. Check back later — your tip is now in his queue.',
                'Janekův tým ho má. Tip je v jeho frontě.',
              )
            : t(
                'We’re running it through spam, dedupe, and AI categorization. Live status below.',
                'Procházíme spam filtr, deduplikaci a AI kategorizaci. Stav níže.',
              )}
        </Text>

        <Card pad={14} bg={HG.cream} style={{ marginTop: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bodyBold,
                fontSize: 11,
                color: HG.inkMute,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('Receipt', 'Doklad')}
            </Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 12, color: HG.ink }}>
              {id ? shortId(id) : '—'}
            </Text>
          </View>
          <Hairline style={{ marginVertical: 10 }} />
          <View style={{ gap: 6 }}>
            <Row
              label={t('Status', 'Stav')}
              value={
                <Chip bg={isReady ? HG.greenSoft : HG.amberSoft} sm>
                  {statusLabel}
                </Chip>
              }
            />
            {category && (
              <Row
                label={t('Category', 'Kategorie')}
                value={
                  <Chip bg={HG.amberSoft} sm>
                    {catLabels[category]}
                  </Chip>
                }
              />
            )}
            {urgency != null && (
              <Row
                label={t('Urgency', 'Naléhavost')}
                value={<Urgency level={urgencyBucket(urgency)} />}
              />
            )}
            {clusterCount > 1 && (
              <Row
                label={t('Cluster', 'Skupina')}
                value={
                  <Chip bg={HG.lilac} sm>
                    +{clusterCount - 1} {t('similar', 'podobných')}
                  </Chip>
                }
              />
            )}
          </View>
        </Card>

        <View style={{ flex: 1 }} />
        <View style={{ gap: 10, paddingBottom: 28, paddingTop: 16 }}>
          <Btn primary full onPress={() => router.replace('/(reporter)')}>
            {t('File another tip', 'Další tip')}
          </Btn>
          <Pressable
            onPress={() => router.push('/(reporter)/past')}
            style={{ paddingVertical: 8, alignItems: 'center' }}
          >
            <Text
              style={{
                fontFamily: FONT.bodySemi,
                fontSize: 13,
                color: HG.inkMute,
              }}
            >
              {t('See my past tips', 'Moje tipy')} →
            </Text>
          </Pressable>
        </View>
      </View>
    </ReporterShell>
  );
}
