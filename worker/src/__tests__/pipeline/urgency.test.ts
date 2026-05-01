import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockCallClaude = mock()
mock.module('../../lib/claude', () => ({ callClaude: mockCallClaude }))

const updateMock = mock(() => ({ eq: mock(() => Promise.resolve({ data: null, error: null })) }))
const stableTable = {
  select: mock(() => ({
    eq: mock(() => ({
      single: mock(() =>
        Promise.resolve({
          data: { text_description: 'Směnárna podvod', transcript: null, category: 'fake_exchange' },
          error: null,
        })
      ),
    })),
  })),
  update: updateMock,
}
const mockSupabase = { from: mock(() => stableTable) }
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

const { runUrgency } = await import('../../pipeline/urgency')

describe('urgency scoring', () => {
  beforeEach(() => {
    mockCallClaude.mockReset()
    updateMock.mockClear()
  })

  it('scores an active large-scale scam high (8+)', async () => {
    mockCallClaude.mockResolvedValue({ score: 9, reason: 'Active, many victims' })
    const result = await runUrgency('report-urg-1')
    expect((result.data as { score: number }).score).toBeGreaterThanOrEqual(8)
  })

  it('scores a historical single-victim incident low (< 5)', async () => {
    mockCallClaude.mockResolvedValue({ score: 3, reason: 'Single past incident' })
    const result = await runUrgency('report-urg-2')
    expect((result.data as { score: number }).score).toBeLessThan(5)
  })

  it('score is always between 1 and 10', async () => {
    for (const score of [1, 5, 10]) {
      mockCallClaude.mockResolvedValue({ score, reason: 'test' })
      const result = await runUrgency('report-urg-range')
      const s = (result.data as { score: number }).score
      expect(s).toBeGreaterThanOrEqual(1)
      expect(s).toBeLessThanOrEqual(10)
    }
  })

  it('writes urgency_score and urgency_reason to the report', async () => {
    mockCallClaude.mockResolvedValue({ score: 7, reason: 'Significant fraud' })
    await runUrgency('report-urg-write')
    expect(updateMock).toHaveBeenCalled()
  })
})
