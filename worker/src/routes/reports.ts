import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { rateLimit } from '../lib/rate-limit'
import { processReport } from '../pipeline/runner'
import { transcribeAudio } from '../lib/openai'
import { logger } from '../lib/logger'

export const reportsRouter = new Hono()

const submitSchema = z.object({
  text_description:   z.string().min(10, 'Description must be at least 10 characters'),
  location:           z.string().max(200).optional(),
  business_name:      z.string().max(200).optional(),
  media_paths:        z.array(z.string()).max(5).optional(),
  audio_path:         z.string().max(500).optional(),
  audio_mime_type:    z.string().max(100).optional(),
  reporter_id:        z.string().uuid().optional(),
})

// ─── POST /reports ─────────────────────────────────────────────────────────────
reportsRouter.post(
  '/',
  rateLimit(5),
  zValidator('json', submitSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: 'Validation failed', details: result.error.issues } },
        400
      )
    }
  }),
  async (c) => {
    const body = c.req.valid('json')

    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        text_description: body.text_description,
        transcript:       body.audio_path ? body.text_description : null,
        location:         body.location ?? null,
        business_name:    body.business_name ?? null,
        reporter_id:      body.reporter_id ?? null,
        status:           'queued',
      })
      .select('id')
      .single()

    if (error || !report) {
      logger.error({ error }, 'failed to insert report')
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save report' } }, 500)
    }

    // Attach images/videos
    const mediaRows: Array<{
      report_id: string
      storage_path: string
      kind: 'image' | 'video' | 'audio'
      mime_type: string
    }> = (body.media_paths ?? []).map((path) => ({
      report_id:    report.id,
      storage_path: path,
      kind:         path.endsWith('.mp4') || path.endsWith('.mov') ? 'video' : 'image',
      mime_type:    path.endsWith('.mp4')
        ? 'video/mp4'
        : path.endsWith('.mov')
          ? 'video/quicktime'
          : 'image/jpeg',
    }))

    // Attach audio (already uploaded via /reports/transcribe)
    if (body.audio_path) {
      mediaRows.push({
        report_id:    report.id,
        storage_path: body.audio_path,
        kind:         'audio',
        mime_type:    body.audio_mime_type ?? 'audio/mp4',
      })
    }

    if (mediaRows.length) {
      await supabase.from('report_media').insert(mediaRows)
    }

    // If audio_path was supplied, Whisper already ran via /reports/transcribe
    // BEFORE this report row existed. Record that as a `done` pipeline run so
    // the audit reads `whisper · done` instead of a misleading `skipped`. The
    // runner short-circuits on existing `done` rows for the same step.
    if (body.audio_path) {
      const now = new Date().toISOString()
      await supabase.from('pipeline_runs').insert({
        report_id:   report.id,
        step:        'whisper',
        status:      'done',
        attempts:    1,
        started_at:  now,
        finished_at: now,
        result:      { transcript_length: body.text_description.length, source: 'pre_transcribed' } as never,
      })
    }

    // Fire-and-forget: pipeline runs async, reporter gets instant response.
    processReport(report.id).catch((err) =>
      logger.error({ reportId: report.id, err }, 'pipeline trigger failed')
    )

    return c.json({ report_id: report.id, status: 'queued' }, 201)
  }
)

// ─── POST /reports/transcribe ──────────────────────────────────────────────────
// Whisper-only: uploads audio + returns transcript so the reporter can review
// before submitting. Does NOT create a report row.
reportsRouter.post(
  '/transcribe',
  rateLimit(5),
  async (c) => {
    const body = await c.req.parseBody()
    const audio = body['audio']

    if (!audio || typeof audio === 'string') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'audio file is required' } }, 400)
    }

    const file = audio as File
    const allowedTypes = ['audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/webm','video/mp4']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported audio format' } }, 400)
    }

    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Audio file exceeds 25 MB limit' } }, 400)
    }

    const ext = file.name?.split('.').pop() ?? 'm4a'
    const storagePath = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('voice')
      .upload(storagePath, file, { contentType: file.type })

    if (uploadError) {
      logger.error({ uploadError }, 'transcribe: audio upload failed')
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Audio upload failed' } }, 500)
    }

    let transcript: string
    try {
      transcript = await transcribeAudio(file as unknown as Blob, file.name ?? storagePath)
    } catch (err) {
      logger.error({ err }, 'transcribe: whisper call failed')
      return c.json(
        { error: { code: 'TRANSCRIPTION_FAILED', message: 'Could not transcribe audio' } },
        500,
      )
    }

    return c.json({
      transcript: transcript.trim(),
      audio_path: storagePath,
      mime_type: file.type,
    })
  }
)

// ─── POST /reports/audio ───────────────────────────────────────────────────────
reportsRouter.post(
  '/audio',
  rateLimit(3),
  async (c) => {
    const body = await c.req.parseBody()
    const audio = body['audio']
    const reporterId = body['reporter_id'] as string | undefined

    if (!audio || typeof audio === 'string') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'audio file is required' } }, 400)
    }

    const file = audio as File
    const allowedTypes = ['audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/webm','video/mp4']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported audio format' } }, 400)
    }

    // Max 25 MB — Whisper API limit
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Audio file exceeds 25 MB limit' } }, 400)
    }

    const ext = file.name.split('.').pop() ?? 'm4a'
    const storagePath = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('voice')
      .upload(storagePath, file, { contentType: file.type })

    if (uploadError) {
      logger.error({ uploadError }, 'audio upload failed')
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Audio upload failed' } }, 500)
    }

    // Create report in 'transcribing' state — worker will pick it up
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId ?? null,
        status:      'transcribing',
      })
      .select('id')
      .single()

    if (insertError || !report) {
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create report' } }, 500)
    }

    await supabase.from('report_media').insert({
      report_id:    report.id,
      storage_path: storagePath,
      kind:         'audio',
      mime_type:    file.type,
      size_bytes:   file.size,
    })

    // Update status to queued so pipeline worker picks it up (whisper step first)
    await supabase
      .from('reports')
      .update({ status: 'queued' })
      .eq('id', report.id)

    processReport(report.id).catch((err) =>
      logger.error({ reportId: report.id, err }, 'audio pipeline trigger failed')
    )

    return c.json({ report_id: report.id, status: 'transcribing', audio_path: storagePath }, 202)
  }
)

// ─── GET /reports/upload-url ───────────────────────────────────────────────────
reportsRouter.get(
  '/upload-url',
  rateLimit(10),
  async (c) => {
    const mimeType = c.req.query('mime_type')
    const kind = c.req.query('kind') as 'image' | 'video' | undefined

    if (!mimeType || !kind) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'mime_type and kind are required' } }, 400)
    }

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    }
    const ext = extMap[mimeType] ?? 'bin'
    const storagePath = `${crypto.randomUUID()}.${ext}`

    const { data, error } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate upload URL' } }, 500)
    }

    return c.json({ upload_url: data.signedUrl, storage_path: storagePath })
  }
)
