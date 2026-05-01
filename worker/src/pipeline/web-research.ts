import { supabase } from '../lib/supabase'
import { searchWeb } from '../lib/tavily'
import { callClaude } from '../lib/claude'
import type { Entity } from '../types/shared'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface RelevanceResult {
  relevance_score: number
  useful_snippet: string
}

const SYSTEM = `You are a research assistant for an investigative journalist.
Given a web search result about a specific business or location, assess
how relevant it is to investigating scam activity at that place.

Score relevance 0.0–1.0:
- 1.0: directly describes fraud, scam complaints, or criminal activity at this place
- 0.7: reviews mentioning overcharging, suspicious behavior, or warnings
- 0.4: general information about the place (not directly about scams)
- 0.0: unrelated content`

export async function runWebResearch(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('entities')
    .eq('id', reportId)
    .single()

  const entities = (report?.entities as Entity[] | null) ?? []
  const actionableEntities = entities.filter(
    (e) => (e.type === 'place' || e.type === 'business') && e.confidence >= 0.7
  )

  if (actionableEntities.length === 0) return { skipped: true }

  const evidenceInserts: Array<{
    report_id: string
    source_url: string
    title: string | null
    snippet: string | null
    relevance_score: number | null
  }> = []

  // Max 3 entity searches per report to control cost
  const entitiesToSearch = actionableEntities.slice(0, 3)

  for (const entity of entitiesToSearch) {
    // Check 7-day cache: if another report already researched this entity, reuse the evidence
    const { data: cached } = await supabase
      .from('evidence')
      .select('source_url, title, snippet, relevance_score')
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .ilike('snippet', `%${entity.name}%`)
      .limit(3)

    if (cached && cached.length > 0) {
      for (const c of cached) {
        evidenceInserts.push({
          report_id: reportId,
          source_url: c.source_url,
          title: c.title,
          snippet: c.snippet,
          relevance_score: c.relevance_score,
        })
      }
      continue
    }

    const query = `"${entity.name}" podvod scam Praha fraud`
    const results = await searchWeb(query, 3)

    for (const result of results) {
      const relevance = await callClaude<RelevanceResult>({
        system: SYSTEM,
        prompt: `Entity: ${entity.name} (${entity.type})\n\nSearch result:\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.snippet}`,
        tool: {
          name: 'assess_relevance',
          description: 'Rate how relevant this search result is to investigating scam activity',
          schema: {
            type: 'object',
            properties: {
              relevance_score: { type: 'number', description: '0.0–1.0' },
              useful_snippet:  { type: 'string', description: 'Most relevant sentence or two from the content' },
            },
            required: ['relevance_score', 'useful_snippet'],
          },
        },
        maxTokens: 512,
      })

      // Only store results with meaningful relevance
      if (relevance.relevance_score >= 0.3) {
        evidenceInserts.push({
          report_id: reportId,
          source_url: result.url,
          title: result.title,
          snippet: relevance.useful_snippet,
          relevance_score: relevance.relevance_score,
        })
      }
    }
  }

  if (evidenceInserts.length > 0) {
    await supabase.from('evidence').insert(evidenceInserts)
  }

  return { data: { evidence_count: evidenceInserts.length, entities_searched: entitiesToSearch.length } }
}
