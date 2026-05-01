import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/db'
import { env } from './env'

// Service role client — bypasses RLS. Never expose to the client.
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
