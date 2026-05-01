import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase'
import { requireAdmin } from '../lib/auth'
import { processReport } from '../pipeline/runner'
import { callClaude } from '../lib/claude'
import { logger } from '../lib/logger'
import type { ReportListItem } from '../types/shared'

export const adminRouter = new Hono()

adminRouter.use('*', requireAdmin)

// ─── GET /admin/reports ────────────────────────────────────────────────────────
adminRouter.get('/reports', async (c) => {
  const category = c.req.query('category')
  const statusParam = c.req.query('status') ?? 'ready'
  const allowedStatuses = ['ready', 'actioned', 'archived', 'spam', 'quarantine'] as const
  type AllowedStatus = (typeof allowedStatuses)[number]
  const status: AllowedStatus = (allowedStatuses as readonly string[]).includes(statusParam)
    ? (statusParam as AllowedStatus)
    : 'ready'

  const sortParam = c.req.query('sort') ?? 'urgency'
  const sort: 'urgency' | 'time' = sortParam === 'time' ? 'time' : 'urgency'

  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const offset = (page - 1) * limit

  let query = supabase
    .from('reports')
    .select(
      `id, created_at, text_description, category, urgency_score, urgency_reason,
       cluster_id, entities,
       report_media(id),
       evidence(id),
       cluster:report_clusters!cluster_id ( report_count )`,
      { count: 'exact' }
    )
    .eq('status', status)
    .range(offset, offset + limit - 1)

  if (sort === 'time') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query
      .order('urgency_score', { ascending: false })
      .order('created_at', { ascending: false })
  }

  if (category) query = query.eq('category', category as 'taxi_scam' | 'fake_exchange' | 'online_fraud' | 'restaurant_scam' | 'other')

  const { data, error, count } = await query

  if (error) {
    logger.error({ error }, 'failed to fetch admin queue')
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reports' } }, 500)
  }

  const reports: ReportListItem[] = (data ?? []).map((r) => {
    const clusterRel = r.cluster as unknown as { report_count: number } | { report_count: number }[] | null
    const cluster_count = Array.isArray(clusterRel)
      ? clusterRel[0]?.report_count ?? null
      : clusterRel?.report_count ?? null
    return {
      id:            r.id,
      created_at:    r.created_at,
      text_description: (r.text_description ?? '').slice(0, 200),
      category:      r.category as ReportListItem['category'],
      urgency_score: r.urgency_score ?? 0,
      urgency_reason: r.urgency_reason ?? '',
      cluster_id:    r.cluster_id,
      cluster_count,
      entity_count:  Array.isArray(r.entities) ? r.entities.length : 0,
      evidence_count: Array.isArray(r.evidence) ? r.evidence.length : 0,
      has_media:     Array.isArray(r.report_media) && r.report_media.length > 0,
    }
  })

  const total = count ?? 0
  return c.json({ reports, total, page, pages: Math.ceil(total / limit) })
})

// ─── GET /admin/reports/:id ────────────────────────────────────────────────────
adminRouter.get('/reports/:id', async (c) => {
  const id = c.req.param('id')

  const [
    { data: report },
    { data: media },
    { data: evidence },
    { data: runs },
    { data: notes },
  ] = await Promise.all([
    supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('report_media')
      .select('*')
      .eq('report_id', id),
    supabase
      .from('evidence')
      .select('*')
      .eq('report_id', id)
      .order('relevance_score', { ascending: false }),
    supabase
      .from('pipeline_runs')
      .select('step, status, attempts, started_at, finished_at, error')
      .eq('report_id', id)
      .order('started_at'),
    supabase
      .from('report_notes')
      .select('id, body, created_at, user_id')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!report) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Report not found' } }, 404)
  }

  // Fetch cluster and similar reports if clustered
  let cluster = null
  if (report.cluster_id) {
    const { data: clusterData } = await supabase
      .from('report_clusters')
      .select('id, canonical_report_id, report_count')
      .eq('id', report.cluster_id)
      .single()

    if (clusterData) {
      const { data: similar } = await supabase
        .from('reports')
        .select('id, created_at, text_description, category, urgency_score, urgency_reason, cluster_id, entities, report_media(id), evidence(id)')
        .eq('cluster_id', report.cluster_id)
        .neq('id', id)
        .eq('status', 'ready')
        .limit(5)

      cluster = {
        id: clusterData.id,
        canonical_report_id: clusterData.canonical_report_id,
        report_count: clusterData.report_count,
        similar_reports: (similar ?? []).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          text_description: (r.text_description ?? '').slice(0, 200),
          category: r.category as ReportListItem['category'],
          urgency_score: r.urgency_score ?? 0,
          urgency_reason: r.urgency_reason ?? '',
          cluster_id: r.cluster_id,
          cluster_count: null,
          entity_count: Array.isArray(r.entities) ? r.entities.length : 0,
          evidence_count: Array.isArray(r.evidence) ? r.evidence.length : 0,
          has_media: Array.isArray(r.report_media) && r.report_media.length > 0,
        })),
      }
    }
  }

  // Write audit log
  await supabase.from('audit_log').insert({
    user_id:   c.get('user').id,
    action:    'report.viewed',
    target_id: id,
  })

  // Generate 1-hour signed URLs for each media item so the admin client can
  // play audio + render images directly. Buckets are private; service-role key
  // mints the URLs.
  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const bucket = m.kind === 'audio' ? 'voice' : 'media'
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(m.storage_path, 3600)
      return {
        ...m,
        signed_url: !error && data ? data.signedUrl : null,
      }
    }),
  )

  // Hydrate note authors with user emails (may be null if user was deleted)
  const noteUserIds = Array.from(
    new Set((notes ?? []).map((n) => n.user_id).filter((u): u is string => !!u)),
  )
  const userEmailMap = new Map<string, string>()
  if (noteUserIds.length) {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 200 })
    for (const u of users ?? []) {
      if (noteUserIds.includes(u.id) && u.email) userEmailMap.set(u.id, u.email)
    }
  }

  return c.json({
    id:               report.id,
    created_at:       report.created_at,
    status:           report.status,
    text_description: report.text_description ?? '',
    transcript:       report.transcript,
    location:         report.location,
    business_name:    report.business_name,
    category:         report.category,
    urgency_score:    report.urgency_score ?? 0,
    urgency_reason:   report.urgency_reason ?? '',
    cluster_id:       report.cluster_id,
    entities:         (report.entities as never) ?? [],
    media:            mediaWithUrls,
    evidence:         evidence ?? [],
    notes:            (notes ?? []).map((n) => ({
      id:         n.id,
      body:       n.body,
      created_at: n.created_at,
      author:     n.user_id ? userEmailMap.get(n.user_id) ?? null : null,
    })),
    cluster,
    pipeline_runs:    runs ?? [],
  })
})

// ─── PATCH /admin/reports/:id ──────────────────────────────────────────────────
// Move between terminal states, or re-open back to `ready`.
const patchSchema = z.object({
  status: z.enum(['actioned', 'archived', 'ready']),
})

adminRouter.patch('/reports/:id', zValidator('json', patchSchema), async (c) => {
  const id = c.req.param('id')
  const { status } = c.req.valid('json')

  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', id)
    .in('status', ['ready', 'actioned', 'archived'])

  if (error) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update report' } }, 500)
  }

  await supabase.from('audit_log').insert({
    user_id:   c.get('user').id,
    action:    status === 'ready' ? 'report.reopened' : `report.${status}`,
    target_id: id,
  })

  return c.json({ id, status })
})

// ─── POST /admin/reports/:id/notes ────────────────────────────────────────────
const noteSchema = z.object({
  body: z.string().min(1).max(5000),
})

adminRouter.post('/reports/:id/notes', zValidator('json', noteSchema), async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')
  const { body } = c.req.valid('json')

  const { data, error } = await supabase
    .from('report_notes')
    .insert({ report_id: id, user_id: user.id, body })
    .select('id, body, created_at, user_id')
    .single()

  if (error || !data) {
    logger.error({ error }, 'failed to insert note')
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to add note' } }, 500)
  }

  await supabase.from('audit_log').insert({
    user_id:   user.id,
    action:    'report.note_added',
    target_id: id,
  })

  return c.json({
    id:         data.id,
    body:       data.body,
    created_at: data.created_at,
    author:     user.email ?? null,
  })
})

// ─── GET /admin/quarantine ────────────────────────────────────────────────────
adminRouter.get('/quarantine', async (c) => {
  const { data, error, count } = await supabase
    .from('reports')
    .select('id, created_at, text_description, category, urgency_score, urgency_reason, cluster_id, entities, report_media(id), evidence(id)', { count: 'exact' })
    .eq('status', 'quarantine')
    .order('created_at', { ascending: true })

  if (error) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch quarantine' } }, 500)
  }

  const reports: ReportListItem[] = (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    text_description: (r.text_description ?? '').slice(0, 200),
    category: r.category as ReportListItem['category'],
    urgency_score: r.urgency_score ?? 0,
    urgency_reason: r.urgency_reason ?? '',
    cluster_id: r.cluster_id,
    cluster_count: null,
    entity_count: Array.isArray(r.entities) ? r.entities.length : 0,
    evidence_count: Array.isArray(r.evidence) ? r.evidence.length : 0,
    has_media: Array.isArray(r.report_media) && r.report_media.length > 0,
  }))

  return c.json({ reports, total: count ?? 0 })
})

// ─── POST /admin/search ───────────────────────────────────────────────────────
// Natural-language search. Claude interprets the query into structured
// filters; the worker applies them and returns the matching reports plus a
// short prose summary the client can render.
const searchSchema = z.object({
  query: z.string().min(1).max(500),
})

interface SearchFilters {
  since?: string | null
  until?: string | null
  category?: 'taxi_scam' | 'fake_exchange' | 'online_fraud' | 'restaurant_scam' | 'other' | null
  status?: 'ready' | 'actioned' | 'archived' | null
  min_urgency_score?: number | null
  text_match?: string | null
  only_clusters?: boolean | null
}

interface SearchInterpretation {
  summary: string
  filters: SearchFilters
}

adminRouter.post('/search', zValidator('json', searchSchema), async (c) => {
  const { query } = c.req.valid('json')
  const now = new Date().toISOString()

  let interp: SearchInterpretation
  try {
    interp = await callClaude<SearchInterpretation>({
      system: `You are a search assistant for Janek, an investigative journalist running a tip line in Prague. He receives reports of scams against tourists.

Categories:
- taxi_scam — broken-meter taxis, fake plates, "card machine broken"
- fake_exchange — exchange booths handing out worthless rubles, hidden spreads
- online_fraud — phishing SMS, fake DPD, dubious listings
- restaurant_scam — trdelník 350 Kč, hidden service charges, menu tricks
- other — pickpockets, fake police, miscellaneous

Status options:
- ready (default — open queue Janek hasn't decided on yet)
- actioned (Janek decided to pursue)
- archived (Janek read and parked)

Urgency is 1–10. "high" ≈ 7+, "critical" ≈ 9+.

Current time is ${now}. Interpret relative time references ("today", "last hour", "this week") against that.

If the user's query is general/unfocused (e.g. "what's going on"), default to status=ready and no other filters — show the full open queue.`,
      prompt: query,
      tool: {
        name: 'filter_reports',
        description:
          'Translate Janek’s natural-language query into structured filters and produce a 1-sentence plain-English summary.',
        schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description:
                "One natural sentence describing what the user asked + what's being shown. Example: 'Showing the 4 taxi reports from the last hour.'",
            },
            filters: {
              type: 'object',
              properties: {
                since: {
                  type: ['string', 'null'],
                  description: 'ISO 8601 lower bound for created_at, or null if no time filter.',
                },
                until: {
                  type: ['string', 'null'],
                  description: 'ISO 8601 upper bound for created_at, or null.',
                },
                category: {
                  type: ['string', 'null'],
                  enum: [
                    'taxi_scam',
                    'fake_exchange',
                    'online_fraud',
                    'restaurant_scam',
                    'other',
                    null,
                  ],
                },
                status: {
                  type: ['string', 'null'],
                  enum: ['ready', 'actioned', 'archived', null],
                  description: 'Default to "ready" unless the user asks about decided/archived items.',
                },
                min_urgency_score: {
                  type: ['number', 'null'],
                  description: 'Minimum urgency_score (1-10), or null.',
                },
                text_match: {
                  type: ['string', 'null'],
                  description: 'Free-text substring to match (case-insensitive) against the report description.',
                },
                only_clusters: {
                  type: ['boolean', 'null'],
                  description: 'If true, restrict to reports that are part of a multi-report cluster.',
                },
              },
              required: [],
            },
          },
          required: ['summary', 'filters'],
        },
      },
    })
  } catch (err) {
    logger.error({ err, query }, 'admin search: claude call failed')
    return c.json(
      { error: { code: 'SEARCH_FAILED', message: 'Could not interpret that query' } },
      500,
    )
  }

  const f = interp.filters
  let q = supabase
    .from('reports')
    .select(
      `id, created_at, text_description, category, urgency_score, urgency_reason,
       cluster_id, entities,
       report_media(id),
       evidence(id),
       cluster:report_clusters!cluster_id ( report_count )`,
      { count: 'exact' },
    )
    .order('urgency_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  q = q.eq('status', f.status ?? 'ready')
  if (f.since) q = q.gte('created_at', f.since)
  if (f.until) q = q.lte('created_at', f.until)
  if (f.category) q = q.eq('category', f.category)
  if (f.min_urgency_score != null) q = q.gte('urgency_score', f.min_urgency_score)
  if (f.text_match) q = q.ilike('text_description', `%${f.text_match}%`)
  if (f.only_clusters) q = q.not('cluster_id', 'is', null)

  const { data, count, error } = await q

  if (error) {
    logger.error({ error }, 'admin search: query failed')
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Search query failed' } },
      500,
    )
  }

  const reports: ReportListItem[] = (data ?? []).map((r) => {
    const clusterRel = r.cluster as unknown as { report_count: number } | { report_count: number }[] | null
    const cluster_count = Array.isArray(clusterRel)
      ? clusterRel[0]?.report_count ?? null
      : clusterRel?.report_count ?? null
    return {
      id: r.id,
      created_at: r.created_at,
      text_description: (r.text_description ?? '').slice(0, 200),
      category: r.category as ReportListItem['category'],
      urgency_score: r.urgency_score ?? 0,
      urgency_reason: r.urgency_reason ?? '',
      cluster_id: r.cluster_id,
      cluster_count,
      entity_count: Array.isArray(r.entities) ? r.entities.length : 0,
      evidence_count: Array.isArray(r.evidence) ? r.evidence.length : 0,
      has_media: Array.isArray(r.report_media) && r.report_media.length > 0,
    }
  })

  return c.json({
    summary: interp.summary,
    filters: f,
    reports,
    total: count ?? reports.length,
  })
})

// ─── POST /admin/quarantine/:id/approve ───────────────────────────────────────
adminRouter.post('/quarantine/:id/approve', async (c) => {
  const id = c.req.param('id')

  // Reset the spam step so pipeline continues from there
  await supabase
    .from('pipeline_runs')
    .update({ status: 'pending', error: null })
    .eq('report_id', id)
    .eq('step', 'spam')

  await supabase
    .from('reports')
    .update({ status: 'queued' })
    .eq('id', id)

  await supabase.from('audit_log').insert({
    user_id:   c.get('user').id,
    action:    'quarantine.approved',
    target_id: id,
  })

  processReport(id).catch((err) => logger.error({ reportId: id, err }, 'quarantine resume failed'))

  return c.json({ report_id: id, status: 'processing' })
})

// ─── POST /admin/quarantine/:id/reject ────────────────────────────────────────
adminRouter.post('/quarantine/:id/reject', async (c) => {
  const id = c.req.param('id')

  await supabase
    .from('reports')
    .update({ status: 'spam' })
    .eq('id', id)

  await supabase.from('audit_log').insert({
    user_id:   c.get('user').id,
    action:    'quarantine.rejected',
    target_id: id,
  })

  return c.json({ report_id: id, status: 'spam' })
})
