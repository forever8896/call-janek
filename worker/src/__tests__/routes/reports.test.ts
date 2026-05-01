import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { createApp } from '../../app'
import { VALID_REPORT_BODY } from '../setup'

// Mock Supabase and pipeline so route tests are pure HTTP tests
const mockProcessReport = mock(() => Promise.resolve())
mock.module('../../pipeline/runner', () => ({
  processReport: mockProcessReport,
  startPipelineWorker: mock(() => {}),
}))

const mockSupabase = {
  from: mock((table: string) => ({
    insert: mock(() => ({
      select: mock(() => ({
        single: mock(() =>
          Promise.resolve({ data: { id: 'new-report-uuid' }, error: null })
        ),
      })),
    })),
    update: mock(() => ({ eq: mock(() => Promise.resolve({ data: null, error: null })) })),
  })),
  storage: {
    from: mock(() => ({
      upload: mock(() => Promise.resolve({ data: {}, error: null })),
      createSignedUploadUrl: mock(() =>
        Promise.resolve({ data: { signedUrl: 'https://storage.example.com/signed' }, error: null })
      ),
    })),
  },
}
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

const app = createApp()

describe('POST /reports', () => {
  beforeEach(() => mockProcessReport.mockClear())

  it('returns 201 with report_id for a valid submission', async () => {
    const res = await app.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_REPORT_BODY),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as { report_id: string; status: string }
    expect(body.report_id).toBe('new-report-uuid')
    expect(body.status).toBe('queued')
  })

  it('triggers pipeline after successful insert', async () => {
    await app.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_REPORT_BODY),
    })

    // Pipeline is fire-and-forget — give it a tick to register
    await new Promise((r) => setTimeout(r, 10))
    expect(mockProcessReport).toHaveBeenCalledWith('new-report-uuid')
  })

  it('returns 400 when text_description is too short', async () => {
    const res = await app.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_description: 'short' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when body is missing entirely', async () => {
    const res = await app.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /reports/upload-url', () => {
  it('returns upload_url and storage_path for a valid image', async () => {
    const res = await app.request('/reports/upload-url?mime_type=image/jpeg&kind=image')

    expect(res.status).toBe(200)
    const body = await res.json() as { upload_url: string; storage_path: string }
    expect(body.upload_url).toContain('https://')
    expect(body.storage_path).toMatch(/\.jpg$/)
  })

  it('returns 400 when mime_type or kind is missing', async () => {
    const res = await app.request('/reports/upload-url?mime_type=image/jpeg')
    expect(res.status).toBe(400)
  })
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('ok')
  })
})
