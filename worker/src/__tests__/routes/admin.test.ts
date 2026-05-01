import { describe, it, expect, mock } from 'bun:test'

// All mock.module() calls before the dynamic import so auth.ts picks up the mocked supabase.
mock.module('../../pipeline/runner', () => ({
  processReport: mock(() => Promise.resolve()),
  startPipelineWorker: mock(() => {}),
}))

// Admin user — used in requireAdmin via supabase.auth.getUser
const ADMIN_USER = {
  id: 'admin-uuid',
  email: 'janek@honestguide.cz',
  user_metadata: { role: 'admin' },
}

const mockGetUser = mock(() =>
  Promise.resolve({ data: { user: ADMIN_USER }, error: null })
)

const mockReports = [
  {
    id: 'rpt-1', created_at: '2026-05-01T10:00:00Z',
    text_description: 'Taxi mě podvedl na letišti Praha.', category: 'taxi_scam',
    urgency_score: 8, urgency_reason: 'Active scam area', cluster_id: null,
    entities: [], report_media: [], evidence: [],
  },
]

// Chainable query builder for admin route queries
function makeChain(result: { data: unknown; error: null; count?: number }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['eq', 'neq', 'in', 'is', 'order', 'range', 'limit']) {
    chain[m] = () => chain
  }
  chain.single = () => Promise.resolve({ data: result.data, error: null })
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const mockSupabase = {
  from: mock(() => ({
    select: mock(() => makeChain({ data: mockReports, error: null, count: 1 })),
    insert: mock(() => makeChain({ data: null, error: null })),
    update: mock(() => makeChain({ data: null, error: null })),
  })),
  auth: { getUser: mockGetUser },
}
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

// Dynamic import AFTER mocks — auth.ts imports supabase, so it gets the mocked version.
const { createApp } = await import('../../app')
const app = createApp()

const ADMIN_HEADERS = {
  Authorization: 'Bearer valid-admin-token',
  'Content-Type': 'application/json',
}

describe('Admin auth guard', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.request('/admin/reports')
    expect(res.status).toBe(401)
  })

  it('returns 401 with malformed token', async () => {
    const res = await app.request('/admin/reports', {
      headers: { Authorization: 'NotBearer token' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'reporter@example.com', user_metadata: { role: 'reporter' } } },
      error: null,
    })

    const res = await app.request('/admin/reports', {
      headers: { Authorization: 'Bearer reporter-token' },
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /admin/reports', () => {
  it('returns paginated report queue for admin', async () => {
    const res = await app.request('/admin/reports', { headers: ADMIN_HEADERS })

    expect(res.status).toBe(200)
    const body = await res.json() as { reports: unknown[]; total: number; page: number }
    expect(Array.isArray(body.reports)).toBe(true)
    expect(body.page).toBe(1)
    expect(typeof body.total).toBe('number')
  })
})

describe('PATCH /admin/reports/:id', () => {
  it('returns 200 when marking a report as actioned', async () => {
    const res = await app.request('/admin/reports/rpt-1', {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ status: 'actioned' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; status: string }
    expect(body.status).toBe('actioned')
  })

  it('returns 400 for invalid status value', async () => {
    const res = await app.request('/admin/reports/rpt-1', {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ status: 'invalid_status' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /admin/quarantine', () => {
  it('returns 200 with quarantine list', async () => {
    const res = await app.request('/admin/quarantine', { headers: ADMIN_HEADERS })
    expect(res.status).toBe(200)
    const body = await res.json() as { reports: unknown[]; total: number }
    expect(Array.isArray(body.reports)).toBe(true)
  })
})
