import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Btn, Chip, Urgency } from '@/components/atoms';
import { AdminHeader, HeaderIconBtn, SectionLabel } from '@/components/admin/Header';
import { AudioPlayer } from '@/components/admin/AudioPlayer';
import { ApiError, addReportNote, getAdminReport, patchAdminReport } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { shortId } from '@/lib/mapping';
import type { Category, ReportDetail, ReportNote } from '@/lib/types';
import { BORDER, FONT, HG, hardShadow } from '@/theme/tokens';

const CAT_LABEL_EN: Record<Category, string> = {
  taxi_scam: 'TAXI SCAM',
  fake_exchange: 'FAKE EXCHANGE',
  online_fraud: 'ONLINE FRAUD',
  restaurant_scam: 'RESTAURANT SCAM',
  other: 'OTHER',
};
const CAT_LABEL_CZ: Record<Category, string> = {
  taxi_scam: 'TAXI PODVOD',
  fake_exchange: 'FALEŠNÁ SMĚNÁRNA',
  online_fraud: 'ONLINE PODVOD',
  restaurant_scam: 'RESTAURACE',
  other: 'JINÉ',
};

function urgencyBucket(score: number): 1 | 2 | 3 | 4 {
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  return 1;
}

export default function AdminDetail() {
  const router = useRouter();
  const t = useT();
  const CAT_LABEL = t('en', 'cz') === 'cz' ? CAT_LABEL_CZ : CAT_LABEL_EN;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [postingNote, setPostingNote] = useState(false);

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

  const onAction = async (status: 'actioned' | 'archived' | 'ready') => {
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

  const onAddNote = async () => {
    if (!id) return;
    const body = noteDraft.trim();
    if (!body) return;
    setPostingNote(true);
    try {
      const note = await addReportNote(id, body);
      setReport((prev) =>
        prev ? { ...prev, notes: [...prev.notes, note as ReportNote] } : prev,
      );
      setNoteDraft('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setPostingNote(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HG.sand }}>
      <View style={{ flex: 1, backgroundColor: HG.sand }}>
        <AdminHeader
          title={t('Report', 'Tip')}
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
              {t('Report not found.', 'Tip nenalezen.')}
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
                {report.transcript
                  ? t('Original tip · transcribed', 'Původní tip · přepsáno')
                  : t('Original tip', 'Původní tip')}
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
                {report.media
                  .filter((m) => m.kind === 'audio' && m.signed_url)
                  .map((m) => (
                    <View key={m.id} style={{ marginTop: 10 }}>
                      <AudioPlayer uri={m.signed_url as string} />
                    </View>
                  ))}
                {report.media
                  .filter((m) => (m.kind === 'image' || m.kind === 'video') && m.signed_url)
                  .map((m) => (
                    <View
                      key={m.id}
                      style={{
                        marginTop: 8,
                        height: 180,
                        borderRadius: 10,
                        borderWidth: BORDER.half,
                        borderColor: HG.ink,
                        overflow: 'hidden',
                        backgroundColor: HG.sand,
                      }}
                    >
                      <Image
                        source={{ uri: m.signed_url as string }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={150}
                      />
                      {m.kind === 'video' && (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            backgroundColor: HG.ink,
                            borderRadius: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: HG.cream,
                              fontFamily: FONT.bodyBold,
                              fontSize: 9,
                              letterSpacing: 0.5,
                            }}
                          >
                            ▶ VIDEO
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
              </View>

              {/* Cluster */}
              {report.cluster && report.cluster.similar_reports.length > 0 && (
                <>
                  <SectionLabel
                    right={
                      <Pressable
                        onPress={() =>
                          router.push(`/(admin)/cluster?clusterId=${report.cluster?.id}`)
                        }
                      >
                        <Text
                          style={{
                            fontFamily: FONT.monoBold,
                            fontSize: 10,
                            color: HG.redInk,
                          }}
                        >
                          {t('EXPAND →', 'ROZBALIT →')}
                        </Text>
                      </Pressable>
                    }
                  >
                    {t(`Cluster · ${report.cluster.report_count} similar`, `Skupina · ${report.cluster.report_count} podobných`)}
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
                  <SectionLabel>
                    {t(
                      `Web research · AI · ${report.evidence.length} sources`,
                      `Webový průzkum · AI · ${report.evidence.length} zdrojů`,
                    )}
                  </SectionLabel>
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

              {/* Newsroom notes */}
              <SectionLabel>
                {t('Newsroom notes', 'Poznámky')}
                {report.notes.length > 0 ? ` · ${report.notes.length}` : ''}
              </SectionLabel>
              <View
                style={{
                  backgroundColor: HG.card,
                  borderWidth: BORDER.half,
                  borderColor: HG.rule,
                  borderRadius: 14,
                  padding: 12,
                  gap: 10,
                }}
              >
                {report.notes.length === 0 && (
                  <Text
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: HG.inkMute,
                    }}
                  >
                    {t('No notes yet — add the first one below.', 'Zatím žádná poznámka — přidej první níže.')}
                  </Text>
                )}
                {report.notes.map((n) => (
                  <View
                    key={n.id}
                    style={{
                      paddingVertical: 6,
                      borderTopWidth: 1,
                      borderColor: HG.rule,
                      borderStyle: 'dashed',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONT.monoBold,
                          fontSize: 9,
                          color: HG.inkMute,
                        }}
                      >
                        {n.author ?? 'admin'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONT.monoBold,
                          fontSize: 9,
                          color: HG.inkDim,
                        }}
                      >
                        {new Date(n.created_at).toLocaleString('en', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: FONT.bodySemi,
                        fontSize: 13,
                        color: HG.ink,
                        lineHeight: 18,
                      }}
                    >
                      {n.body}
                    </Text>
                  </View>
                ))}

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder={t('Add a note (newsroom-only)', 'Přidat poznámku (interní)')}
                    placeholderTextColor={HG.inkMute}
                    multiline
                    style={{
                      flex: 1,
                      fontFamily: FONT.bodySemi,
                      fontSize: 13,
                      color: HG.ink,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      backgroundColor: HG.cream,
                      borderWidth: BORDER.half,
                      borderColor: HG.ink,
                      borderRadius: 10,
                      minHeight: 36,
                    }}
                    editable={!postingNote}
                  />
                  <Pressable
                    onPress={onAddNote}
                    disabled={!noteDraft.trim() || postingNote}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor:
                        !noteDraft.trim() || postingNote ? HG.inkDim : HG.amberSoft,
                      borderWidth: BORDER.half,
                      borderColor: HG.ink,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.bodyBold,
                        fontSize: 12,
                        color: HG.ink,
                      }}
                    >
                      {postingNote ? '…' : t('Add', 'Přidat')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Pipeline runs */}
              {report.pipeline_runs.length > 0 && (
                <>
                  <SectionLabel>{t('Pipeline · audit', 'Pipeline · audit')}</SectionLabel>
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
              {report.status === 'ready' ? (
                <>
                  <Btn
                    full
                    sm
                    bg={HG.card}
                    color={HG.ink}
                    onPress={() => onAction('archived')}
                  >
                    {acting ? '…' : t('✓ Reviewed', '✓ Vyřízeno')}
                  </Btn>
                  <Btn
                    full
                    sm
                    bg={HG.red}
                    color={HG.cream}
                    onPress={() => onAction('actioned')}
                  >
                    {acting ? '…' : t('🔥 Actioned', '🔥 Pronásleduji')}
                  </Btn>
                </>
              ) : (
                <Btn
                  full
                  sm
                  bg={HG.amberSoft}
                  color={HG.ink}
                  onPress={() => onAction('ready')}
                >
                  {acting
                    ? '…'
                    : t(
                        `↺ Re-open (was ${report.status})`,
                        `↺ Znovu otevřít (bylo ${
                          report.status === 'actioned' ? 'řešeno' : 'archivováno'
                        })`,
                      )}
                </Btn>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
