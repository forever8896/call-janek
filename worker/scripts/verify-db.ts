import postgres from 'postgres'

const sql = postgres({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  username: 'postgres.ctldinopklfbcqlwggqh',
  password: 'nf1VC5cy9GOcwf9T',
  ssl: 'require',
  max: 1,
})

const tables = await sql`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`
console.log('Tables:', tables.map((t: { tablename: string }) => t.tablename).join(', '))

const cats = await sql`SELECT id FROM categories ORDER BY id`
console.log('Categories:', cats.map((c: { id: string }) => c.id).join(', '))

const extensions = await sql`SELECT extname FROM pg_extension WHERE extname IN ('vector','pg_cron')`
console.log('Extensions:', extensions.map((e: { extname: string }) => e.extname).join(', '))

await sql.end()
