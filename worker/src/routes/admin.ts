import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase'
import { requireAdmin } from '../lib/auth'
import { processReport } from '../pipeline/runner'
import { logger } from '../lib/logger'
import type { ReportListItem } from '../types/shared'

export const adminRouter = new Hono()

adminRouter.use('*', requireAdmin)

// ─── GET /admin/reports ────────────────────────────────────────────────────────
adminRouter.get('/reports', async (c) => {
  const category = c.req.query('category')
  const statusParam = c.req.query('status') ?? 'ready'
  const allowedStatuses = ['ready', 'actioned', 'archived'] as const
  type AllowedStatus = (typeof allowedStatuses)[number]
  const status: AllowedStatus = (allowedStatuses as readonly string[]).includes(statusParam)
    ? (statusParam as AllowedStatus)
    : 'ready'

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
    .order('urgency_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category as 'taxi_scam' | 'fake_exchange' | 'online_fraud' | 'restaurant_scam' | 'other')

  const { data, error, count } = await query

  if (error) {
    logger.error({ error }, 'failed to fetch admin queue')
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reports' } }, 500)
  }

  const reports: ReportListItem[] = (data ?? []).map((r) => {
    const clusterRel = r.cluster as { report_count: number } | { report_count: number }[] | null
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
