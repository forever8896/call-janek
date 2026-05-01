import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Btn, Card, Chip } from '@/components/atoms';
import { CatIll, CatKey } from '@/components/illustrations';
import { ReporterShell, ReporterTopBar } from '@/components/reporter/Shell';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { shortId } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import type { Category, ReportStatus } from '@/lib/types';
import { BORDER, FONT, HG } from '@/theme/tokens';

type Row = {
  id: string;
  created_at: string;
  status: ReportStatus;
  category: Category | null;
  text_description: string | null;
  cluster_id: string | null;
};

const CAT_TO_ICON: Record<Category, CatKey> = {
  taxi_scam: 'taxi',
  fake_exchange: 'exchange',
  online_fraud: 'online',
  restaurant_scam: 'menu',
  other: 'pickpocket',
};

const STATUS_BG: Record<ReportStatus, string> = {
  queued: HG.amberSoft,
  transcribing: HG.amberSoft,
  processing: HG.amberSoft,
  ready: HG.lilac,
  actioned: HG.greenSoft,
  archived: HG.greenSoft,
  spam: HG.redSoft,
  quarantine: HG.redSoft,
};

export default function Past() {
  const router = useRouter();
  const t = useT();
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('id, created_at, status, category, text_description, cluster_id')
      .eq('reporter_id', session.user.id)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ReporterShell>
      <ReporterTopBar
        title={t(`My tips · ${rows.length} filed`, `Moje tipy · ${rows.length} podáno`)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      >
        <Text
          style={{
            fontFamily: FONT.displaySemi,
            fontSize: 26,
            letterSpacing: -0.4,
            paddingHorizontal: 4,
            paddingTop: 4,
            paddingBottom: 14,
            color: HG.ink,
          }}
        >
          {t('Tips you’ve filed', 'Tvoje tipy')}
        </Text>

        {loading && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color={HG.ink} />
          </View>
        )}

        {!loading && rows.length === 0 && (
          <Card pad={14} bg={HG.paper}>
            <Text
              style={{
                fontFamily: FONT.displayItalic,
                fontSize: 15,
                color: HG.inkMute,
                textAlign: 'center',
              }}
            >
              {t('No tips yet. Tap “New tip” to file one.', 'Zatím nic. Klepni „Nový tip“.')}
            </Text>
          </Card>
        )}

        <View style={{ gap: 12 }}>
          {rows.map((it) => {
            const icon: CatKey = it.category ? CAT_TO_ICON[it.category] : 'trdelnik';
            return (
              <Card
                key={it.id}
                pad={12}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: STATUS_BG[it.status],
                    borderWidth: BORDER.half,
                    borderColor: HG.ink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CatIll cat={icon} size={42} />
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: HG.inkMute }}>
                      {shortId(it.id)}
                    </Text>
                    <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: HG.inkMute }}>
                      {new Date(it.created_at).toLocaleDateString('en', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: FONT.bodySemi,
                      fontSize: 13,
                      color: HG.ink,
                      marginTop: 2,
                      lineHeight: 18,
                    }}
                    numberOfLines={2}
                  >
                    {it.text_description || t('(processing)', '(zpracovává se)')}
                  </Text>
                  <View
                    style={{
                      marginTop: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Chip sm bg={STATUS_BG[it.status]}>
                      {it.status.toUpperCase()}
                    </Chip>
                    {it.cluster_id && (
                      <Text
                        style={{ fontFamily: FONT.monoBold, fontSize: 10, color: HG.inkMute }}
                      >
                        {t('clustered', 've skupině')}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
          borderTopWidth: 1.5,
          borderColor: HG.ink,
          backgroundColor: HG.cream,
        }}
      >
        <Btn primary full onPress={() => router.replace('/(reporter)')}>
          {t('+ New tip', '+ Nový tip')}
        </Btn>
      </View>
    </ReporterShell>
  );
}
