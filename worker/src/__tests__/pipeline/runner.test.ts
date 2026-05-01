import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Track DB calls
const dbUpdates: Array<Record<string, unknown>> = []
const dbUpserts: Array<Record<string, unknown>> = []

// Chainable query builder supporting .eq().eq() chains
function makeChain(singleResult: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  for (const m of ['eq', 'neq', 'in', 'is', 'lt', 'lte', 'gt', 'gte', 'order', 'limit', 'range']) {
    chain[m] = () => chain
  }
  chain.single      = () => Promise.resolve(singleResult)
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  chain.then        = (resolve: (v: unknown) => unknown) => Promise.resolve(singleResult).then(resolve)
  return chain
}

const mockSupabase = {
  from: mock(() => ({
    select: mock(() => makeChain({ data: { status: 'processing', text_description: 'Test tip', transcript: null }, error: null })),
    update: mock((data: Record<string, unknown>) => {
      dbUpdates.push(data)
      return makeChain({ data: null, error: null })
    }),
    upsert: mock((data: Record<string, unknown>) => {
      dbUpserts.push(data)
      return makeChain({ data: null, error: null })
    }),
  })),
  channel: mock(() => ({ on: mock(() => ({ subscribe: mock(() => {}) })) })),
}
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))
mock.module('../../lib/env', () => ({ env: { WORKER_CONCURRENCY: 8, WORKER_POLL_BATCH: 20, NODE_ENV: 'test' } }))

// Dynamic import after supabase mock — do NOT mock individual pipeline step modules.
// Instead, mutate _handlers directly to avoid polluting the module cache for step test files.
const { processReport, _handlers } = await import('../../pipeline/runner')

// Step mocks injected directly into _handlers
const mockWhisper     = mock(() => Promise.resolve({ skipped: true }))
const mockSpam        = mock(() => Promise.resolve({ data: { is_spam: false } }))
const mockDedupe      = mock(() => Promise.resolve({ data: { cluster_id: null } }))
const mockCategory    = mock(() => Promise.resolve({ data: { category: 'taxi_scam' } }))
const mockUrgency     = mock(() => Promise.resolve({ data: { score: 7 } }))
const mockEntities    = mock(() => Promise.resolve({ data: { entities: [] } }))
const mockWebResearch = mock(() => Promise.resolve({ skipped: true }))

_handlers.whisper      = mockWhisper
_handlers.spam         = mockSpam
_handlers.dedupe       = mockDedupe
_handlers.category     = mockCategory
_handlers.urgency      = mockUrgency
_handlers.entities     = mockEntities
_handlers.web_research = mockWebResearch

describe('pipeline runner', () => {
  beforeEach(() => {
    dbUpdates.length = 0
    dbUpserts.length = 0
    mockWhisper.mockReset()
    mockSpam.mockReset()
    mockDedupe.mockReset()
    mockCategory.mockReset()
    mockUrgency.mockReset()
    mockEntities.mockReset()
    mockWebResearch.mockReset()

    // Default: all steps succeed
    mockWhisper.mockResolvedValue({ skipped: true })
    mockSpam.mockResolvedValue({ data: { is_spam: false } })
    mockDedupe.mockResolvedValue({ data: { cluster_id: null } })
    mockCategory.mockResolvedValue({ data: { category: 'taxi_scam' } })
    mockUrgency.mockResolvedValue({ data: { score: 7 } })
    mockEntities.mockResolvedValue({ data: { entities: [] } })
    mockWebResearch.mockResolvedValue({ skipped: true })

    // Re-inject after reset (reset clears the function reference in _handlers)
    _handlers.whisper      = mockWhisper
    _handlers.spam         = mockSpam
    _handlers.dedupe       = mockDedupe
    _handlers.category     = mockCategory
    _handlers.urgency      = mockUrgency
    _handlers.entities     = mockEntities
    _handlers.web_research = mockWebResearch
  })

  it('runs all steps and marks report as ready on success', async () => {
    await processReport('report-run-1')

    expect(mockWhisper).toHaveBeenCalled()
    expect(mockSpam).toHaveBeenCalled()
    expect(mockDedupe).toHaveBeenCalled()
    expect(mockCategory).toHaveBeenCalled()
    expect(mockUrgency).toHaveBeenCalled()
    expect(mockEntities).toHaveBeenCalled()
  })

  it('does not process the same report concurrently', async () => {
    // Simulate a long step
    mockSpam.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ data: { is_spam: false } }), 50))
    )

    const p1 = processReport('report-concurrent')
    const p2 = processReport('report-concurrent') // same ID

    await Promise.all([p1, p2])

    // Spam step called only once despite two concurrent calls
    expect(mockSpam.mock.calls.length).toBe(1)
  })
})
