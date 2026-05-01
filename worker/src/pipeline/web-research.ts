import { supabase } from '../lib/supabase'
import { searchWeb } from '../lib/tavily'
import { callClaude } from '../lib/claude'
import { logger } from '../lib/logger'
import type { Entity } from '../types/shared'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface ResearchPlan {
  should_research: boolean
  reason: string
  queries: string[]
}

interface RelevanceResult {
  relevance_score: number
  useful_snippet: string
}

const PLANNER_SYSTEM = `You decide whether a scam tip is worth a public web search,
and craft the search queries if it is.

Search ONLY when the tip names a concrete, locatable target a journalist could
investigate further on the open web. Examples of concrete targets:
- a specific street address, building number, or named landmark
- a registered/named business (exchange office name, restaurant name, taxi company)
- a domain, phone number, or vehicle plate
- a named person who runs the operation

Do NOT search when the tip describes only a generic, untraceable target:
- "a guy on the street", "a street vendor", "an exchange booth somewhere"
- a category alone ("trdelník stand", "silver Škoda taxi") with no plate, address, or business name
- vague online activity with no domain, account name, or campaign signature

When you do search, write 1–3 short queries a journalist would actually run.
Queries should combine the most specific identifier with Czech-relevant scam terms
("podvod", "scam", "Praha", "stížnost"). One query per concrete target. No quotes
unless the term is a proper noun. Keep queries under ~10 words.

If should_research is false, leave queries empty and explain why in reason.`

const RELEVANCE_SYSTEM = `You are a research assistant for an investigative journalist.
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
    .select('text_description, transcript, entities')
    .eq('id', reportId)
    .single()

  const entities = (report?.entities as Entity[] | null) ?? []
  const tipText = report?.text_description ?? report?.transcript ?? ''

  // Cheap pre-gate: nothing extracted at all → no point asking the LLM.
  // Saves a Claude call per ~half the burst that the entity step found nothing in.
  if (entities.length === 0) {
    return { skipped: true, data: { reason: 'no entities extracted' } }
  }

  // LLM gate: decide if anything is concrete enough to research, and craft queries.
  // The model sees both the raw tip and the structured entities so it can judge
  // specificity (a street name is researchable; "a street vendor" isn't).
  const plan = await callClaude<ResearchPlan>({
    system: PLANNER_SYSTEM,
    prompt: `Tip:\n${tipText}\n\nExtracted entities:\n${JSON.stringify(entities, null, 2)}`,
    tool: {
      name: 'plan_research',
      description: 'Decide whether to web-search this tip and craft the queries',
      schema: {
        type: 'object',
        properties: {
          should_research: { type: 'boolean' },
          reason:          { type: 'string', description: 'Brief explanation of the decision' },
          queries:         {
            type:        'array',
            items:       { type: 'string' },
            description: 'Up to 3 search queries; empty if should_research is false',
          },
        },
        required: ['should_research', 'reason', 'queries'],
      },
    },
    maxTokens: 512,
  })

  if (!plan.should_research || plan.queries.length === 0) {
    logger.info({ reportId, reason: plan.reason }, 'web research skipped by LLM gate')
    return { skipped: true, data: { reason: plan.reason } }
  }

  const queries = plan.queries.slice(0, 3) // hard cap regardless of LLM output
  const evidenceInserts: Array<{
    report_id: string
    source_url: string
    title: string | null
    snippet: string | null
    relevance_score: number | null
  }> = []

  for (const query of queries) {
    // 7-day cache: if another report already searched this query, reuse evidence.
    // We key the cache on the query string itself rather than entity name now.
    const { data: cached } = await supabase
      .from('evidence')
      .select('source_url, title, snippet, relevance_score')
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .ilike('snippet', `%${query.split(' ')[0]}%`)
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

    const results = await searchWeb(query, 3)

    for (const result of results) {
      const relevance = await callClaude<RelevanceResult>({
        system: RELEVANCE_SYSTEM,
        prompt: `Query: ${query}\n\nSearch result:\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.snippet}`,
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

  return {
    data: {
      evidence_count:  evidenceInserts.length,
      queries_run:     queries.length,
      planner_reason:  plan.reason,
    },
  }
}
