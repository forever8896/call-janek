import { describe, it, expect, mock } from 'bun:test'

// Mirror the runner.test.ts setup: mock supabase + env BEFORE importing the runner.
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
    update: mock(() => makeChain({ data: null, error: null })),
    upsert: mock(() => makeChain({ data: null, error: null })),
  })),
  channel: mock(() => ({ on: mock(() => ({ subscribe: mock(() => {}) })) })),
}
mock.module('../../lib/supabase', () => ({ supabase: mockSupabase }))

// Cap at 3 so we can verify the across-report concurrency limit.
const CONCURRENCY = 3
mock.module('../../lib/env', () => ({ env: { WORKER_CONCURRENCY: CONCURRENCY, WORKER_POLL_BATCH: 20, NODE_ENV: 'test' } }))

const { processReport, _handlers, _poolStats } = await import('../../pipeline/runner')

describe('pipeline pool', () => {
  it('caps concurrent report processing at WORKER_CONCURRENCY', async () => {
    let inFlightSteps = 0
    let peakInFlight = 0
    const releases: Array<() => void> = []

    // Make every step block on a manually-released promise so we can observe
    // exactly how many are active at any given moment.
    const blockingStep = () =>
      new Promise<{ skipped: boolean }>((resolve) => {
        inFlightSteps++
        peakInFlight = Math.max(peakInFlight, inFlightSteps)
        releases.push(() => {
          inFlightSteps--
          resolve({ skipped: true })
        })
      })

    for (const step of Object.keys(_handlers) as (keyof typeof _handlers)[]) {
      _handlers[step] = blockingStep
    }

    // Fire 8 reports at once. With CONCURRENCY=3, only 3 should run their first
    // step in parallel; the other 5 should be queued.
    const total = 8
    const promises = Array.from({ length: total }, (_, i) => processReport(`report-${i}`))

    // Let the event loop run so the pool drains.
    await new Promise((r) => setTimeout(r, 20))

    const stats = _poolStats()
    expect(stats.active).toBe(CONCURRENCY)
    expect(stats.queued).toBe(total - CONCURRENCY)
    expect(peakInFlight).toBeLessThanOrEqual(CONCURRENCY)

    // Drain: release in-flight steps one at a time, advancing the pool.
    while (releases.length > 0) {
      const r = releases.shift()!
      r()
      await new Promise((res) => setTimeout(res, 5))
    }

    await Promise.all(promises)
    expect(_poolStats().active).toBe(0)
    expect(_poolStats().queued).toBe(0)
    expect(peakInFlight).toBeLessThanOrEqual(CONCURRENCY)
  })

  it('dedupes same report id (Realtime + poll racing)', async () => {
    let calls = 0
    const slowStep = () =>
      new Promise<{ skipped: boolean }>((resolve) => {
        calls++
        setTimeout(() => resolve({ skipped: true }), 30)
      })

    for (const step of Object.keys(_handlers) as (keyof typeof _handlers)[]) {
      _handlers[step] = slowStep
    }

    // Fire the same id three times in quick succession.
    const id = 'dup-report'
    const p1 = processReport(id)
    const p2 = processReport(id)
    const p3 = processReport(id)

    await Promise.all([p1, p2, p3])

    // 7 steps × 1 run-through = 7 calls. If dedup failed we'd see 14 or 21.
    expect(calls).toBe(7)
  })
})
