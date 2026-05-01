import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test'
import { createSupabaseMock, SPAM_TEXT, LEGIT_CZECH_TIP } from '../setup'

// ─── Mock external dependencies before importing the step ────────────────────

const mockCallClaude = mock()
mock.module('../../lib/claude', () => ({ callClaude: mockCallClaude }))

const mockSupabase = createSupabaseMock({
  selectResult: { data: { text_description: LEGIT_CZECH_TIP, transcript: null }, error: null },
  updateResult: { data: null, error: null },
})
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

const { runSpam } = await import('../../pipeline/spam')

describe('spam filter', () => {
  beforeEach(() => {
    mockCallClaude.mockReset()
    mockSupabase._table.update.mockClear()
  })

  it('passes a legitimate Czech tip through without touching status', async () => {
    mockCallClaude.mockResolvedValue({ is_spam: false, confidence: 0.05, reason: 'Legitimate scam tip' })

    const result = await runSpam('report-1')

    expect(result.skipped).toBeUndefined()
    expect(mockSupabase._table.update).not.toHaveBeenCalled()
  })

  it('marks high-confidence spam as spam and stops pipeline', async () => {
    mockCallClaude.mockResolvedValue({ is_spam: true, confidence: 0.97, reason: 'Advertisement' })

    await runSpam('report-2')

    const calls = mockSupabase._table.update.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(calls[0]?.[0]).toEqual({ status: 'spam' })
  })

  it('routes borderline spam to quarantine (confidence 0.5–0.85)', async () => {
    mockCallClaude.mockResolvedValue({ is_spam: true, confidence: 0.70, reason: 'Possibly spam' })

    await runSpam('report-3')

    const calls = mockSupabase._table.update.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(calls[0]?.[0]).toEqual({ status: 'quarantine' })
  })

  it('routes high-confidence spam directly to spam (>= 0.85)', async () => {
    mockCallClaude.mockResolvedValue({ is_spam: true, confidence: 0.92, reason: 'Clear spam' })

    await runSpam('report-4')

    const calls = mockSupabase._table.update.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(calls[0]?.[0]).toEqual({ status: 'spam' })
  })

  it('returns the Claude result as step data', async () => {
    const claudeResult = { is_spam: false, confidence: 0.02, reason: 'Real tip' }
    mockCallClaude.mockResolvedValue(claudeResult)

    const result = await runSpam('report-5')

    expect(result.data).toEqual(claudeResult)
  })
})
