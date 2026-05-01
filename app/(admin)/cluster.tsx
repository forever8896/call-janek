import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/atoms';
import { AdminHeader } from '@/components/admin/Header';
import { useT } from '@/lib/i18n';
import { shortId } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

type ClusterRow = {
  id: string;
  created_at: string;
  text_description: string | null;
  urgency_score: number | null;
};

type ClusterMeta = {
  id: string;
  canonical_report_id: string;
  report_count: number;
  created_at: string;
};

export default function AdminCluster() {
  const router = useRouter();
  const t = useT();
  const { clusterId } = useLocalSearchParams<{ clusterId?: string }>();
  const [meta, setMeta] = useState<ClusterMeta | null>(null);
  const [rows, setRows] = useState<ClusterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clusterId) {
        setError('No cluster id provided');
        setLoading(false);
        return;
      }
      try {
        const [{ data: m, error: mErr }, { data: r, error: rErr }] = await Promise.all([
          supabase
            .from('report_clusters')
            .select('id, canonical_report_id, report_count, created_at')
            .eq('id', clusterId)
            .single(),
          supabase
            .from('reports')
            .select('id, created_at, text_description, urgency_score')
            .eq('cluster_id', clusterId)
            .order('created_at', { ascending: false }),
        ]);
        if (cancelled) return;
        if (mErr) throw mErr;
        if (rErr) throw rErr;
        setMeta(m as ClusterMeta);
        setRows((r ?? []) as ClusterRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader
          title={t('Cluster', 'Skupina')}
          subtitle={
            meta
              ? `${meta.report_count} ${t('REPORTS', meta.report_count < 5 ? 'TIPY' : 'TIPŮ')}`
              : t('Loading…', 'Načítám…')
          }
          onBack={() => router.back()}
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={HG.ink} />
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 12, color: HG.red }}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            {meta && (
              <View
                style={{
                  padding: 14,
                  borderBottomWidth: 1.5,
                  borderColor: HG.rule,
                }}
              >
                <View
                  style={[
                    {
                      backgroundColor: HG.lilac,
                      borderWidth: BORDER.full,
                      borderColor: HG.ink,
                      borderRadius: 14,
                      padding: 12,
                    },
                    hardShadow(3),
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: FONT.bodyBold,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      color: HG.inkMute,
                    }}
                  >
                    {t('Rolled-up incident', 'Sdružený případ')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.display,
                      fontSize: 17,
                      lineHeight: 22,
                      marginTop: 4,
                      color: HG.ink,
                    }}
                  >
                    {t(
                      `Cluster ${shortId(meta.id)} — ${meta.report_count} similar reports.`,
                      `Skupina ${shortId(meta.id)} — ${meta.report_count} podobných tipů.`,
                    )}
                  </Text>
                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <Text style={{ fontFamily: FONT.bodyBold, fontSize: 12, color: HG.ink }}>
                      <Text style={{ fontSize: 18 }}>{meta.report_count}</Text>{' '}
                      {t('victims', 'obětí')}
                    </Text>
                    <Chip bg={HG.red} color={HG.cream} sm>
                      {t('● Active', '● Aktivní')}
                    </Chip>
                  </View>
                </View>
              </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
              {rows.map((c) => (
                <View
                  key={c.id}
                  style={{
                    backgroundColor: HG.card,
                    borderWidth: BORDER.half,
                    borderColor: HG.rule,
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ width: 64 }}>
                    <Text
                      style={{ fontFamily: FONT.monoBold, fontSize: 9, color: HG.redInk }}
                    >
                      {shortId(c.id)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONT.monoBold,
                        fontSize: 9,
                        color: HG.inkDim,
                        marginTop: 2,
                      }}
                    >
                      {new Date(c.created_at).toLocaleDateString('en', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: FONT.body,
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: HG.ink,
                      lineHeight: 16,
                    }}
                    numberOfLines={3}
                  >
                    &ldquo;{c.text_description ?? '(no transcript)'}&rdquo;
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
