import { describe, it, expect, beforeEach } from 'bun:test'
import { rateLimit, _clearStore } from '../../lib/rate-limit'
import { Hono } from 'hono'

function createTestApp(max: number, windowMs = 60_000) {
  const app = new Hono()
  app.get('/test', rateLimit(max, windowMs), (c) => c.json({ ok: true }))
  return app
}

function makeRequest(app: Hono, ip = '1.2.3.4') {
  return app.request('/test', { headers: { 'x-forwarded-for': ip } })
}

describe('rateLimit', () => {
  beforeEach(() => _clearStore())

  it('allows requests under the limit', async () => {
    const app = createTestApp(3)
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(app)
      expect(res.status).toBe(200)
    }
  })

  it('blocks requests over the limit', async () => {
    const app = createTestApp(2)
    await makeRequest(app)
    await makeRequest(app)
    const res = await makeRequest(app)
    expect(res.status).toBe(429)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('tracks limits per IP independently', async () => {
    const app = createTestApp(1)
    const resA = await makeRequest(app, '10.0.0.1')
    const resB = await makeRequest(app, '10.0.0.2')
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
  })

  it('resets after the window expires', async () => {
    const app = createTestApp(1, 50) // 50ms window
    await makeRequest(app)
    const blocked = await makeRequest(app)
    expect(blocked.status).toBe(429)

    await new Promise((r) => setTimeout(r, 60))

    const allowed = await makeRequest(app)
    expect(allowed.status).toBe(200)
  })
})
