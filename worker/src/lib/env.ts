import { z } from 'zod'

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),
  WORKER_POLL_BATCH: z.coerce.number().int().min(1).max(100).default(20),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Missing or invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
