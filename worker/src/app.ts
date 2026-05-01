import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { cors } from 'hono/cors'
import { reportsRouter } from './routes/reports'
import { adminRouter } from './routes/admin'
import { env } from './lib/env'

export function createApp() {
  const app = new Hono()

  app.use('*', honoLogger())
  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }))

  app.get('/health', (c) =>
    c.json({ status: 'ok', version: '1.0.0', env: env.NODE_ENV })
  )

  app.route('/reports', reportsRouter)
  app.route('/admin', adminRouter)

  app.onError((err, c) => {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
  })

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: `${c.req.method} ${c.req.path} not found` } }, 404)
  )

  return app
}
