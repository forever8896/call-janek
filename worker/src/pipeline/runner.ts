import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

type Step = 'whisper' | 'spam' | 'dedupe' | 'category' | 'urgency' | 'entities' | 'web_research'

const STEPS: Step[] = ['whisper', 'spam', 'dedupe', 'category', 'urgency', 'entities', 'web_research']

type StepFn = (reportId: string) => Promise<{ skipped?: boolean; data?: unknown }>

// Lazy imports keep each step's module out of runner's static dependency graph,
// which prevents module-cache pollution in tests (each step file can be mocked independently).
export const _handlers: Record<Step, StepFn> = {
  whisper:      (id) => import('./whisper').then((m) => m.runWhisper(id)),
  spam:         (id) => import('./spam').then((m) => m.runSpam(id)),
  dedupe:       (id) => import('./dedupe').then((m) => m.runDedupe(id)),
  category:     (id) => import('./category').then((m) => m.runCategory(id)),
  urgency:      (id) => import('./urgency').then((m) => m.runUrgency(id)),
  entities:     (id) => import('./entities').then((m) => m.runEntities(id)),
  web_research: (id) => import('./web-research').then((m) => m.runWebResearch(id)),
}

// Guards against processing the same report concurrently
const inFlight = new Set<string>()

export async function processReport(reportId: string): Promise<void> {
  if (inFlight.has(reportId)) return
  inFlight.add(reportId)

  try {
    await runPipeline(reportId)
  } finally {
    inFlight.delete(reportId)
  }
}

async function runPipeline(reportId: string): Promise<void> {
  logger.info({ reportId }, 'pipeline started')

  await supabase
    .from('reports')
    .update({ status: 'processing', pipeline_started_at: new Date().toISOString() })
    .eq('id', reportId)

  for (const step of STEPS) {
    // Check if already done or skipped from a previous attempt
    const { data: existing } = await supabase
      .from('pipeline_runs')
      .select('status')
      .eq('report_id', reportId)
      .eq('step', step)
      .maybeSingle()

    if (existing?.status === 'done' || existing?.status === 'skipped') continue

    try {
      await runStep(reportId, step)
    } catch (err) {
      logger.error({ reportId, step, err }, 'pipeline step failed after max retries')
      // Leave report in 'processing' — recovery cron will reset and retry
      return
    }

    // After spam/quarantine the pipeline stops — Janek decides what happens next
    const { data: report } = await supabase
      .from('reports')
      .select('status')
      .eq('id', reportId)
      .single()

    if (report?.status === 'spam' || report?.status === 'quarantine') {
      logger.info({ reportId, status: report.status }, 'pipeline stopped')
      return
    }
  }

  await supabase
    .from('reports')
    .update({ status: 'ready', pipeline_completed_at: new Date().toISOString() })
    .eq('id', reportId)

  logger.info({ reportId }, 'pipeline done → ready')
}

async function runStep(reportId: string, step: Step): Promise<void> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await supabase.from('pipeline_runs').upsert(
      { report_id: reportId, step, status: 'running', started_at: new Date().toISOString(), attempts: attempt },
      { onConflict: 'report_id,step' }
    )

    try {
      const result = await _handlers[step](reportId)

      await supabase
        .from('pipeline_runs')
        .update({
          status: result.skipped ? 'skipped' : 'done',
          finished_at: new Date().toISOString(),
          result: (result.data ?? null) as never,
          error: null,
        })
        .eq('report_id', reportId)
        .eq('step', step)

      logger.debug({ reportId, step, skipped: result.skipped }, 'step done')
      return
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.warn({ reportId, step, attempt, error }, 'step failed')

      if (attempt === maxAttempts) {
        await supabase
          .from('pipeline_runs')
          .update({ status: 'failed', finished_at: new Date().toISOString(), error })
          .eq('report_id', reportId)
          .eq('step', step)

        throw err
      }

      // Exponential backoff: 1s, 4s, 9s
      await new Promise((r) => setTimeout(r, attempt * attempt * 1000))
    }
  }
}

// ─── Worker bootstrap ──────────────────────────────────────────────────────────

export function startPipelineWorker(): void {
  // Primary: Supabase Realtime notifies us on every new queued report
  supabase
    .channel('pipeline-trigger')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reports', filter: 'status=eq.queued' },
      (payload) => {
        const reportId = (payload.new as { id: string }).id
        processReport(reportId).catch((err) => logger.error({ reportId, err }, 'pipeline crash'))
      }
    )
    .subscribe((status) => {
      logger.info({ status }, 'realtime subscription')
    })

  // Fallback: catch any reports that slipped through (missed notification, server restart)
  setInterval(async () => {
    const { data } = await supabase
      .from('reports')
      .select('id')
      .eq('status', 'queued')
      .is('pipeline_started_at', null)
      .lt('created_at', new Date(Date.now() - 10_000).toISOString())
      .limit(10)

    for (const row of data ?? []) {
      processReport(row.id).catch((err) => logger.error({ reportId: row.id, err }, 'poll pipeline crash'))
    }
  }, 5_000)

  logger.info('pipeline worker started')
}
