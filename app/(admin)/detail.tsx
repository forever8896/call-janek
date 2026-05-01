import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Chip, Urgency, Waveform } from '@/components/atoms';
import { AdminHeader, HeaderIconBtn, SectionLabel } from '@/components/admin/Header';
import { ApiError, getAdminReport, patchAdminReport } from '@/lib/api';
import { shortId } from '@/lib/mapping';
import type { Category, ReportDetail } from '@/lib/types';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

const CAT_LABEL: Record<Category, string> = {
  taxi_scam: 'TAXI SCAM',
  fake_exchange: 'FAKE EXCHANGE',
  online_fraud: 'ONLINE FRAUD',
  restaurant_scam: 'RESTAURANT SCAM',
  other: 'OTHER',
};

function urgencyBucket(score: number): 1 | 2 | 3 | 4 {
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  return 1;
}

export default function AdminDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminReport(id);
      setReport(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onAction = async (status: 'actioned' | 'archived') => {
    if (!id) return;
    setActing(true);
    try {
      await patchAdminReport(id, status);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader
          title="Report"
          subtitle={report ? shortId(report.id) : id ? shortId(id) : ''}
          onBack={() => router.back()}
          right={<HeaderIconBtn bg={HG.amberSoft}>★</HeaderIconBtn>}
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
        ) : !report ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontFamily: FONT.displayItalic, fontSize: 16, color: HG.inkMute }}>
              Report not found.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 16,
              }}
            >
              {/* Hero summary */}
              <View
                style={[
                  {
                    backgroundColor: HG.amberSoft,
                    borderWidth: BORDER.full,
                    borderColor: HG.ink,
                    borderRadius: 16,
                    padding: 14,
                  },
                  hardShadow(3),
                ]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <Urgency level={urgencyBucket(report.urgency_score ?? 0)} />
                  {report.category && (
                    <Chip bg={HG.cream} sm>
                      {CAT_LABEL[report.category]}
                    </Chip>
                  )}
                  {report.cluster && (
                    <Chip bg={HG.lilac} sm>
                      ×{report.cluster.report_count} CLUSTER
                    </Chip>
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 17,
                    lineHeight: 22,
                    color: HG.ink,
                  }}
                >
                  {report.urgency_reason || report.text_description}
                </Text>
                {report.entities.length > 0 && (
                  <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {report.entities.map((e, i) => (
                      <View
                        key={i}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          backgroundColor: HG.cream,
                          borderWidth: BORDER.half,
                          borderColor: HG.ink,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{ fontFamily: FONT.bodySemi, fontSize: 11, color: HG.ink }}
                        >
                          {e.type === 'place' ? '📍 ' : e.type === 'business' ? '🏪 ' : '👤 '}
                          {e.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Original tip */}
              <SectionLabel>
                {report.transcript ? 'Original tip · transcribed' : 'Original tip'}
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
                <Text
                  style={{
                    fontFamily: FONT.bodySemi,
                    fontSize: 13,
                    lineHeight: 20,
                    color: HG.ink,
                  }}
                >
                  &ldquo;{report.text_description || report.transcript || '(empty)'}&rdquo;
                </Text>
                {report.media.some((m) => m.kind === 'audio') && (
                  <View
                    style={{
                      marginTop: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      backgroundColor: HG.cream,
                      borderWidth: BORDER.half,
                      borderColor: HG.rule,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: HG.amberSoft,
                        borderWidth: BORDER.half,
                        borderColor: HG.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: FONT.bodyBold, color: HG.ink, fontSize: 14 }}>
                        ▶
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Waveform color={HG.amberSoft} active={false} bars={20} />
                    </View>
                  </View>
                )}
                {report.media
                  .filter((m) => m.kind === 'image')
                  .slice(0, 2)
                  .map((m, i) => (
                    <View
                      key={m.id}
                      style={{
                        marginTop: 8,
                        height: 70,
                        backgroundColor: i === 0 ? HG.peach : HG.sky,
                        borderRadius: 10,
                        borderWidth: BORDER.half,
                        borderColor: HG.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONT.bodyBold,
                          fontSize: 10,
                          color: HG.ink,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        📷 {m.kind}
                      </Text>
                    </View>
                  ))}
              </View>

              {/* Cluster */}
              {report.cluster && report.cluster.similar_reports.length > 0 && (
                <>
                  <SectionLabel
                    right={
                      <Pressable onPress={() => router.push('/(admin)/cluster')}>
                        <Text
                          style={{
                            fontFamily: FONT.monoBold,
                            fontSize: 10,
                            color: HG.redInk,
                          }}
                        >
                          EXPAND →
                        </Text>
                      </Pressable>
                    }
                  >
                    Cluster · {report.cluster.report_count} similar
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
                    {report.cluster.similar_reports.map((c, i) => (
                      <View
                        key={c.id}
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          paddingVertical: 8,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderColor: HG.rule,
                          borderStyle: 'dashed',
                        }}
                      >
                        <Text
                          style={{
                            width: 60,
                            fontFamily: FONT.monoBold,
                            fontSize: 10,
                            color: HG.redInk,
                          }}
                        >
                          {shortId(c.id)}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: FONT.body,
                            fontSize: 12,
                            fontStyle: 'italic',
                            color: HG.ink,
                          }}
                          numberOfLines={2}
                        >
                          &ldquo;{c.text_description}&rdquo;
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Evidence */}
              {report.evidence.length > 0 && (
                <>
                  <SectionLabel>Web research · AI · {report.evidence.length} sources</SectionLabel>
                  <View style={{ gap: 8 }}>
                    {report.evidence.map((e) => (
                      <View
                        key={e.id}
                        style={{
                          backgroundColor: HG.card,
                          borderWidth: BORDER.half,
                          borderColor: HG.rule,
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: FONT.monoBold,
                              fontSize: 9,
                              color: HG.inkMute,
                            }}
                            numberOfLines={1}
                          >
                            🔗 {e.source_url.replace(/^https?:\/\//, '')}
                          </Text>
                          {e.relevance_score != null && (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                backgroundColor: e.relevance_score > 0.7 ? HG.greenSoft : HG.sky,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: HG.ink,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT.bodyBold,
                                  fontSize: 9,
                                  color: HG.ink,
                                }}
                              >
                                {Math.round(e.relevance_score * 100)}%
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{
                            fontFamily: FONT.bodySemi,
                            fontSize: 12,
                            color: HG.ink,
                            lineHeight: 16,
                          }}
                        >
                          {e.title || e.snippet || '(no title)'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Pipeline runs */}
              {report.pipeline_runs.length > 0 && (
                <>
                  <SectionLabel>Pipeline · audit</SectionLabel>
                  <View
                    style={{
                      backgroundColor: HG.card,
                      borderWidth: BORDER.half,
                      borderColor: HG.rule,
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    {report.pipeline_runs.map((r, i) => (
                      <View
                        key={`${r.step}-${i}`}
                        style={{
                          flexDirection: 'row',
                          paddingVertical: 4,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderColor: HG.rule,
                          borderStyle: 'dashed',
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: FONT.monoBold,
                            fontSize: 10,
                            color: HG.ink,
                          }}
                        >
                          {r.step}
                        </Text>
                        <Text
                          style={{
                            fontFamily: FONT.monoBold,
                            fontSize: 10,
                            color:
                              r.status === 'failed'
                                ? HG.red
                                : r.status === 'done'
                                  ? HG.green
                                  : HG.inkMute,
                          }}
                        >
                          {r.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: 12,
                borderTopWidth: 1.5,
                borderColor: HG.rule,
              }}
            >
              <Btn
                full
                sm
                bg={HG.card}
                color={HG.ink}
                onPress={() => onAction('archived')}
              >
                {acting ? '…' : '✓ Reviewed'}
              </Btn>
              <Btn
                full
                sm
                bg={HG.red}
                color={HG.cream}
                onPress={() => onAction('actioned')}
              >
                {acting ? '…' : '🔥 Actioned'}
              </Btn>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
