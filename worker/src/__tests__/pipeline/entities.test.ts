import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockCallClaude = mock()
mock.module('../../lib/claude', () => ({ callClaude: mockCallClaude }))

const updateMock = mock(() => ({ eq: mock(() => Promise.resolve({ data: null, error: null })) }))
const stableTable = {
  select: mock(() => ({
    eq: mock(() => ({
      single: mock(() =>
        Promise.resolve({
          data: {
            text_description: 'Směnárna ABC na Václavském náměstí mi vzala 500 Kč navíc.',
            transcript: null,
            location: 'Václavské náměstí',
            business_name: 'Směnárna ABC',
          },
          error: null,
        })
      ),
    })),
  })),
  update: updateMock,
}
const mockSupabase = { from: mock(() => stableTable) }
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

const { runEntities } = await import('../../pipeline/entities')

describe('entity extraction', () => {
  beforeEach(() => {
    mockCallClaude.mockReset()
    updateMock.mockClear()
  })

  it('extracts place and business entities from a tip', async () => {
    mockCallClaude.mockResolvedValue({
      entities: [
        { type: 'place',    name: 'Václavské náměstí', confidence: 0.95 },
        { type: 'business', name: 'Směnárna ABC',       confidence: 0.92 },
      ],
    })

    const result = await runEntities('report-ent-1')
    const entities = (result.data as { entities: Array<{ type: string }> }).entities
    expect(entities).toHaveLength(2)
    expect(entities.some((e) => e.type === 'place')).toBe(true)
    expect(entities.some((e) => e.type === 'business')).toBe(true)
  })

  it('returns empty array when no named entities are found', async () => {
    mockCallClaude.mockResolvedValue({ entities: [] })

    const result = await runEntities('report-ent-2')
    const entities = (result.data as { entities: unknown[] }).entities
    expect(entities).toHaveLength(0)
  })

  it('writes entities to the report row', async () => {
    mockCallClaude.mockResolvedValue({ entities: [{ type: 'place', name: 'Praha', confidence: 0.9 }] })
    await runEntities('report-ent-write')
    expect(updateMock).toHaveBeenCalled()
  })
})
