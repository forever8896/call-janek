import postgres from 'postgres'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const DB_PASSWORD = 'nf1VC5cy9GOcwf9T'
const PROJECT_REF = 'ctldinopklfbcqlwggqh'

// Try multiple connection endpoints in order
const ENDPOINTS = [
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
]

async function tryConnect(host: string) {
  const sql = postgres({
    host,
    port: 5432,
    database: 'postgres',
    username: `postgres.${PROJECT_REF}`,
    password: DB_PASSWORD,
    ssl: 'require',
    connect_timeout: 8,
    max: 1,
  })

  // Quick ping
  await sql`SELECT 1`
  return sql
}

async function runMigrations() {
  let sql: ReturnType<typeof postgres> | null = null

  for (const host of ENDPOINTS) {
    try {
      process.stdout.write(`Trying ${host} ... `)
      sql = await tryConnect(host)
      console.log('connected ✓')
      break
    } catch (err) {
      console.log(`failed (${(err as Error).message.split('\n')[0]})`)
    }
  }

  if (!sql) {
    console.error('\nCould not connect to any endpoint.')
    process.exit(1)
  }

  const migrationsDir = join(import.meta.dir, '../../supabase/migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`\nRunning ${files.length} migration(s):\n`)

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const content = await readFile(filePath, 'utf-8')
    process.stdout.write(`  ${file} ... `)
    try {
      await sql.unsafe(content)
      console.log('done ✓')
    } catch (err) {
      const msg = (err as Error).message
      // Ignore "already exists" errors so migrations are idempotent
      if (msg.includes('already exists') || msg.includes('duplicate key')) {
        console.log('skipped (already applied)')
      } else {
        console.log(`ERROR: ${msg}`)
        await sql.end()
        process.exit(1)
      }
    }
  }

  await sql.end()
  console.log('\nAll migrations complete.')
}

runMigrations().catch(err => {
  console.error(err)
  process.exit(1)
})
