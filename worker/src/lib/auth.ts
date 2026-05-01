import { createMiddleware } from 'hono/factory'
import { supabase } from './supabase'

export type AuthUser = {
  id: string
  email: string | undefined
  role: string | undefined
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export const requireAdmin = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } }, 401)
  }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401)
  }

  const role = user.user_metadata?.['role'] as string | undefined
  if (role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403)
  }

  c.set('user', { id: user.id, email: user.email, role })
  await next()
})
