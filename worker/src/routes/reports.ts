import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { rateLimit } from '../lib/rate-limit'
import { processReport } from '../pipeline/runner'
import { logger } from '../lib/logger'

export const reportsRouter = new Hono()

const submitSchema = z.object({
  text_description: z.string().min(10, 'Description must be at least 10 characters'),
  location:         z.string().max(200).optional(),
  business_name:    z.string().max(200).optional(),
  media_paths:      z.array(z.string()).max(5).optional(),
  reporter_id:      z.string().uuid().optional(),
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

    // Attach media if provided
    if (body.media_paths?.length) {
      await supabase.from('report_media').insert(
        body.media_paths.map((path) => ({
          report_id:    report.id,
          storage_path: path,
          kind:         'image' as const,
          mime_type:    'image/jpeg',
        }))
      )
    }

    // Fire-and-forget: pipeline runs async, reporter gets instant response
    processReport(report.id).catch((err) =>
      logger.error({ reportId: report.id, err }, 'pipeline trigger failed')
    )

    return c.json({ report_id: report.id, status: 'queued' }, 201)
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
