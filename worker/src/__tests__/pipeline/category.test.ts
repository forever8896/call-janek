import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mutable ref avoids any mock-reset/implementation timing issues with module mocks.
let _claudeResult: Record<string, unknown> = {}
const mockCallClaude = mock(() => Promise.resolve(_claudeResult))
mock.module('../../lib/claude', () => ({ callClaude: mockCallClaude }))

const updateMock = mock(() => ({ eq: mock(() => Promise.resolve({ data: null, error: null })) }))
const stableTable = {
  select: mock(() => ({
    eq: mock(() => ({
      single: mock(() =>
        Promise.resolve({
          data: { text_description: 'Taxikář mě overchargoval na letišti Praha.', transcript: null, category: null },
          error: null,
        })
      ),
    })),
  })),
  update: updateMock,
}
const mockSupabase = { from: mock(() => stableTable) }
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

const { runCategory } = await import('../../pipeline/category')

describe('categorization', () => {
  beforeEach(() => updateMock.mockClear())

  it('classifies taxi_scam correctly', async () => {
    _claudeResult = { category: 'taxi_scam', confidence: 0.95, reasoning: 'matches category' }
    const result = await runCategory('report-cat-1')
    expect((result.data as { category: string }).category).toBe('taxi_scam')
  })

  it('classifies fake_exchange correctly', async () => {
    _claudeResult = { category: 'fake_exchange', confidence: 0.95, reasoning: 'matches category' }
    const result = await runCategory('report-cat-2')
    expect((result.data as { category: string }).category).toBe('fake_exchange')
  })

  it('classifies online_fraud correctly', async () => {
    _claudeResult = { category: 'online_fraud', confidence: 0.95, reasoning: 'matches category' }
    const result = await runCategory('report-cat-3')
    expect((result.data as { category: string }).category).toBe('online_fraud')
  })

  it('classifies restaurant_scam correctly', async () => {
    _claudeResult = { category: 'restaurant_scam', confidence: 0.95, reasoning: 'matches category' }
    const result = await runCategory('report-cat-4')
    expect((result.data as { category: string }).category).toBe('restaurant_scam')
  })

  it('classifies other correctly', async () => {
    _claudeResult = { category: 'other', confidence: 0.95, reasoning: 'matches category' }
    const result = await runCategory('report-cat-5')
    expect((result.data as { category: string }).category).toBe('other')
  })

  it('writes category to the report row', async () => {
    _claudeResult = { category: 'taxi_scam', confidence: 0.9, reasoning: '' }
    await runCategory('report-cat-write')
    expect(updateMock).toHaveBeenCalled()
  })
})
