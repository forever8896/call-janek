import { supabase } from '../lib/supabase'
import { embedText } from '../lib/openai'

// Cosine similarity threshold — reports above this score are considered duplicates.
// Tuned conservatively; lower = more aggressive clustering. Revisit with real data.
const SIMILARITY_THRESHOLD = 0.88

export async function runDedupe(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('text_description, transcript, location, business_name')
    .eq('id', reportId)
    .single()

  const text = [
    report?.text_description ?? report?.transcript ?? '',
    report?.location ?? '',
    report?.business_name ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  if (!text) return { skipped: true }

  const embedding = await embedText(text)

  await supabase
    .from('report_embeddings')
    .upsert({ report_id: reportId, embedding })

  const { data: matches } = await supabase.rpc('match_reports', {
    query_embedding: embedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: 5,
  })

  const similar = (matches ?? []).filter((m) => m.report_id !== reportId)
  if (similar.length === 0) return { data: { cluster_id: null, similarity: 0 } }

  const mostSimilar = similar[0]!

  const { data: siblingReport } = await supabase
    .from('reports')
    .select('cluster_id')
    .eq('id', mostSimilar.report_id)
    .single()

  let clusterId: string

  if (siblingReport?.cluster_id) {
    clusterId = siblingReport.cluster_id

    // Fetch current count and increment
    const { data: cluster } = await supabase
      .from('report_clusters')
      .select('report_count')
      .eq('id', clusterId)
      .single()

    await supabase
      .from('report_clusters')
      .update({ report_count: (cluster?.report_count ?? 1) + 1, updated_at: new Date().toISOString() })
      .eq('id', clusterId)
  } else {
    // Create new cluster; mark the canonical report too
    const { data: cluster } = await supabase
      .from('report_clusters')
      .insert({ canonical_report_id: mostSimilar.report_id, report_count: 2 })
      .select('id')
      .single()

    if (!cluster) throw new Error('Failed to create report cluster')
    clusterId = cluster.id

    await supabase
      .from('reports')
      .update({ cluster_id: clusterId })
      .eq('id', mostSimilar.report_id)
  }

  await supabase
    .from('reports')
    .update({ cluster_id: clusterId })
    .eq('id', reportId)

  return { data: { cluster_id: clusterId, similarity: mostSimilar.similarity, matches: similar.length } }
}
