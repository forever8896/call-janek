// Quick post-burst sanity check — counts current burst rows by status so we
// can see whether the worker on Railway is actually consuming them.
import { createClient } from '@supabase/supabase-js'
import { env } from '../src/lib/env'
import type { Database } from '../src/types/db'

const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('reports')
  .select('status')
  .eq('business_name', '__burst__')

if (error) {
  console.error(error)
  process.exit(1)
}

const counts: Record<string, number> = {}
for (const r of data ?? []) {
  counts[r.status] = (counts[r.status] ?? 0) + 1
}

console.log(`burst rows: ${data?.length ?? 0}`)
for (const [k, v] of Object.entries(counts).sort()) {
  console.log(`  ${k.padEnd(12)} ${v}`)
}
