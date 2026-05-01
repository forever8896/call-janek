import { createMiddleware } from 'hono/factory'

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

function checkLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= max) return false

  bucket.count++
  return true
}

export function _clearStore() {
  store.clear()
}

export function rateLimit(max: number, windowMs = 60 * 60 * 1000) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
    const key = `${c.req.path}:${ip}`

    if (!checkLimit(key, max, windowMs)) {
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } },
        429
      )
    }

    await next()
  })
}
