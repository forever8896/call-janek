import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Chip } from '@/components/atoms';
import { AdminHeader, SectionLabel } from '@/components/admin/Header';
import { Mascot } from '@/components/mascot';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { shortId } from '@/lib/mapping';
import { supabase } from '@/lib/supabase';
import { BORDER, FONT, HG } from '@/theme/tokens';

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  target_id: string | null;
};

export default function AdminSettings() {
  const router = useRouter();
  const t = useT();
  const PREFS: [string, string][] = [
    [t('Default sort', 'Výchozí řazení'), t('Urgency ↓', 'Naléhavost ↓')],
    [t('Auto-cluster threshold', 'Práh seskupení'), '≥ 0.78 sim'],
    [t('Push notifications', 'Notifikace'), t('CRIT only', 'Jen kritické')],
    [t('Quiet hours', 'Tichý režim'), '00:00 → 06:00'],
  ];
  const { session, signOut } = useAuth();
  const [log, setLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('id, created_at, action, target_id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) {
        setLog((data ?? []) as AuditRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader
          title={t('Settings', 'Nastavení')}
          subtitle="JANEK · ADMIN"
          onBack={() => router.back()}
        />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
          <View
            style={{
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.rule,
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Mascot kind="janek" size={64} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.displaySemiItalic, fontSize: 18, color: HG.ink }}>
                {session?.user?.email ?? 'Admin'}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.monoBold,
                  fontSize: 10,
                  color: HG.inkMute,
                  letterSpacing: 0.4,
                }}
              >
                {session?.user?.last_sign_in_at
                  ? `${t('LAST', 'NAPOSLEDY')} ${new Date(session.user.last_sign_in_at).toLocaleString(t('en', 'cs'), {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}`
                  : t('NOT SIGNED IN', 'NEPŘIHLÁŠEN')}
              </Text>
            </View>
          </View>

          <SectionLabel>{t('Queue preferences', 'Nastavení fronty')}</SectionLabel>
          <View
            style={{
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.rule,
              borderRadius: 14,
              padding: 12,
            }}
          >
            {PREFS.map(([l, v], i) => (
              <View
                key={l}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderStyle: 'dashed',
                  borderColor: HG.rule,
                }}
              >
                <Text style={{ fontFamily: FONT.bodySemi, fontSize: 13, color: HG.ink }}>{l}</Text>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: HG.redInk }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>

          <SectionLabel
            right={
              <Chip bg={HG.ink} color={HG.cream} sm>
                {t('EXPORT CSV', 'EXPORT CSV')}
              </Chip>
            }
          >
            {t('Audit log · recent', 'Audit · poslední')}
          </SectionLabel>
          <View
            style={{
              backgroundColor: HG.card,
              borderWidth: BORDER.half,
              borderColor: HG.rule,
              borderRadius: 14,
              padding: 12,
            }}
          >
            {loading ? (
              <View style={{ alignItems: 'center', padding: 8 }}>
                <ActivityIndicator color={HG.ink} />
              </View>
            ) : log.length === 0 ? (
              <Text
                style={{
                  fontFamily: FONT.displayItalic,
                  fontSize: 13,
                  color: HG.inkMute,
                  padding: 8,
                }}
              >
                {t('No actions logged yet.', 'Zatím žádné akce.')}
              </Text>
            ) : (
              log.map((row, i) => {
                const isCritical =
                  row.action.includes('actioned') || row.action.includes('escalated');
                return (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 6,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderStyle: 'dashed',
                      borderColor: HG.rule,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        width: 60,
                        fontFamily: FONT.mono,
                        fontSize: 11,
                        color: HG.inkMute,
                      }}
                    >
                      {new Date(row.created_at).toLocaleTimeString('en', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: FONT.monoBold,
                        fontSize: 11,
                        color: isCritical ? HG.red : HG.ink,
                      }}
                    >
                      {row.action.replace('report.', '')}
                    </Text>
                    {row.target_id && (
                      <Text
                        style={{ fontFamily: FONT.monoBold, fontSize: 11, color: HG.redInk }}
                      >
                        {shortId(row.target_id)}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 16 }} />
          <Btn full onPress={onSignOut} bg={HG.card} color={HG.ink}>
            {t('Sign out', 'Odhlásit se')}
          </Btn>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
