// Seed the DB with a realistic spread of Prague scam reports so the admin
// queue is not empty for demos. Idempotent: deletes anything previously
// seeded by this script before re-inserting.
//
//   bun run scripts/seed.ts            # default: ~25 reports, 5 clusters
//   bun run scripts/seed.ts --clear    # only delete previous seed, no insert
//
// Marker: every seeded report's business_name is set to '__seed__' so we
// can find + delete on re-run without touching real data.

import { createClient } from '@supabase/supabase-js'
import { env } from '../src/lib/env'
import type { Database } from '../src/types/db'

const SEED_MARKER = '__seed__'

const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Cat = 'taxi_scam' | 'fake_exchange' | 'online_fraud' | 'restaurant_scam' | 'other'
type Status = 'ready' | 'actioned' | 'archived'

type Seed = {
  text: string
  category: Cat
  urgency: number          // 1–10
  urgency_reason: string
  status: Status
  location: string
  entities: Array<{ type: 'place' | 'business' | 'person'; name: string; confidence: number }>
  cluster_key?: string     // groups multiple seeds into one cluster
  created_minutes_ago: number
}

// ─── Cluster: silver Škoda taxis with plate prefix 4AM ────────────
const TAXI_CLUSTER: Seed[] = [
  {
    text: 'Got into a taxi at Old Town Square around 11pm. Driver said the meter was broken and quoted 1,800 CZK to my hotel near Náměstí Míru. Silver Škoda, plate started 4AM. No receipt.',
    category: 'taxi_scam',
    urgency: 9,
    urgency_reason: 'Active scheme, 4-8x fare overcharge, multiple recent victims around Old Town',
    status: 'ready',
    location: 'Staroměstské náměstí',
    entities: [
      { type: 'place', name: 'Staroměstské náměstí', confidence: 0.98 },
      { type: 'business', name: 'silver Škoda taxi (4AM-xxxx)', confidence: 0.9 },
    ],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 9,
  },
  {
    text: 'Tourist friend got picked up near the Astronomical Clock by a silver Škoda taxi. Charged 1,500 CZK to Vinohrady. The meter was supposedly broken.',
    category: 'taxi_scam',
    urgency: 7,
    urgency_reason: 'Same MO as the 4AM cluster — broken-meter routine, Old Town pickup',
    status: 'ready',
    location: 'Staroměstská',
    entities: [{ type: 'place', name: 'Staroměstská', confidence: 0.92 }],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 120,
  },
  {
    text: 'Plate 4AM-2391, silver Škoda. Took 25 minutes to drive 4 km from Old Town to Karlin. Quoted 2,200 CZK, refused card.',
    category: 'taxi_scam',
    urgency: 8,
    urgency_reason: 'Same plate prefix, no card, scenic-route padding to inflate meter',
    status: 'ready',
    location: 'Karlín',
    entities: [
      { type: 'business', name: '4AM-2391', confidence: 0.96 },
      { type: 'place', name: 'Karlín', confidence: 0.85 },
    ],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 480,
  },
  {
    text: 'Charged 90 EUR cash from a silver Škoda from Old Town to my hotel. Driver said card machine was broken. No receipt issued.',
    category: 'taxi_scam',
    urgency: 6,
    urgency_reason: 'EUR cash extracted, recurring "card machine broken" lie',
    status: 'ready',
    location: 'Staré Město',
    entities: [{ type: 'place', name: 'Staré Město', confidence: 0.9 }],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 60 * 18,
  },
  {
    text: 'Quoted 2,200 CZK for a hotel transfer. No receipt, silver Škoda from Old Town with no rooftop sign.',
    category: 'taxi_scam',
    urgency: 4,
    urgency_reason: 'Older report; same vehicle profile',
    status: 'archived',
    location: 'Staré Město',
    entities: [],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 60 * 24 * 4,
  },
  {
    text: 'First report: silver Škoda picked me up near the Old Town Hall, no rooftop sign. Charged 1,200 CZK for a 1.5 km ride.',
    category: 'taxi_scam',
    urgency: 3,
    urgency_reason: 'Earliest known instance of the cluster',
    status: 'archived',
    location: 'Staré Město',
    entities: [],
    cluster_key: 'taxi-4AM',
    created_minutes_ago: 60 * 24 * 19,
  },
]

// ─── Cluster: fake Belarusian ruble exchange on Václavské náměstí ─
const EXCHANGE_CLUSTER: Seed[] = [
  {
    text: 'Exchange booth on Václavské náměstí 32 advertised 0% commission and 24 CZK/EUR. After signing, they handed me Belarusian rubles instead of euros and refused to refund. Real rate was 18 CZK/EUR.',
    category: 'fake_exchange',
    urgency: 8,
    urgency_reason: 'Active fraudulent exchange, fine print misrepresentation, victim count rising',
    status: 'ready',
    location: 'Václavské náměstí 32',
    entities: [
      { type: 'place', name: 'Václavské náměstí 32', confidence: 0.99 },
      { type: 'business', name: 'Exchange Centrum Praha', confidence: 0.85 },
    ],
    cluster_key: 'exchange-vaclavak',
    created_minutes_ago: 23,
  },
  {
    text: 'Same exchange booth Václavské nám. — handed me Belarusian rubles (BYR) instead of EUR. Lost about 200 EUR.',
    category: 'fake_exchange',
    urgency: 7,
    urgency_reason: 'Repeat MO, repeat location',
    status: 'ready',
    location: 'Václavské náměstí',
    entities: [{ type: 'place', name: 'Václavské náměstí', confidence: 0.95 }],
    cluster_key: 'exchange-vaclavak',
    created_minutes_ago: 60 * 4,
  },
  {
    text: 'Tourist swapped 300 EUR for "rubles" at a Václavské nám booth. They posted "0% commission" but spread was 35%. No registry number visible.',
    category: 'fake_exchange',
    urgency: 6,
    urgency_reason: 'No commission disclosure, hidden spread',
    status: 'ready',
    location: 'Václavské náměstí',
    entities: [],
    cluster_key: 'exchange-vaclavak',
    created_minutes_ago: 60 * 12,
  },
  {
    text: 'Exchange booth near the metro entrance on Václavák — clerk got aggressive when I asked for the receipt. Receipt finally given, written by hand, no business ID.',
    category: 'fake_exchange',
    urgency: 5,
    urgency_reason: 'Aggressive clerk, missing legal documentation',
    status: 'actioned',
    location: 'Václavské náměstí',
    entities: [],
    cluster_key: 'exchange-vaclavak',
    created_minutes_ago: 60 * 24 * 2,
  },
]

// ─── Cluster: trdelník stand near Charles Bridge ──────────────────
const TRDELNIK_CLUSTER: Seed[] = [
  {
    text: 'Trdelník stand on Křižovnická 3 near Charles Bridge — 350 CZK each, no pricing visible. Tourists are paying 6x the going rate.',
    category: 'restaurant_scam',
    urgency: 5,
    urgency_reason: 'Hidden pricing, tourist-targeted, around Charles Bridge',
    status: 'ready',
    location: 'Křižovnická 3',
    entities: [
      { type: 'place', name: 'Křižovnická 3', confidence: 0.95 },
      { type: 'business', name: 'trdelník stand', confidence: 0.85 },
    ],
    cluster_key: 'trdelnik-charles',
    created_minutes_ago: 41,
  },
  {
    text: 'Trdelník near Karlův most: 320 Kč for a regular cone, no menu. Asked for a receipt, owner refused.',
    category: 'restaurant_scam',
    urgency: 4,
    urgency_reason: 'No printed menu, refusal to issue receipts',
    status: 'ready',
    location: 'Karlův most',
    entities: [],
    cluster_key: 'trdelnik-charles',
    created_minutes_ago: 60 * 8,
  },
  {
    text: 'Two trdelník stands on either end of Karlův most charging 350 CZK and 380 CZK. Standard price elsewhere is 80–100 CZK.',
    category: 'restaurant_scam',
    urgency: 3,
    urgency_reason: 'Coordinated price gouging across stands',
    status: 'ready',
    location: 'Karlův most',
    entities: [],
    cluster_key: 'trdelnik-charles',
    created_minutes_ago: 60 * 24 * 3,
  },
]

// ─── Cluster: fake DPD redelivery SMS phishing ────────────────────
const DPD_CLUSTER: Seed[] = [
  {
    text: 'Got an SMS pretending to be from DPD asking for a 35 Kč redelivery fee at bit.ly/d-pd. The page asked for full card details and CVV. Recipients all over Prague.',
    category: 'online_fraud',
    urgency: 7,
    urgency_reason: 'Active phishing campaign, card harvesting, CZ-wide',
    status: 'ready',
    location: 'Online · CZ-wide',
    entities: [
      { type: 'business', name: 'DPD impersonator', confidence: 0.98 },
      { type: 'business', name: 'bit.ly/d-pd', confidence: 0.95 },
    ],
    cluster_key: 'dpd-phish',
    created_minutes_ago: 60,
  },
  {
    text: 'My grandmother got the same DPD redelivery SMS asking for 35 Kč. She lost 4,500 Kč after entering her card.',
    category: 'online_fraud',
    urgency: 9,
    urgency_reason: 'Confirmed financial loss, vulnerable victim',
    status: 'ready',
    location: 'Online',
    entities: [],
    cluster_key: 'dpd-phish',
    created_minutes_ago: 60 * 5,
  },
  {
    text: 'DPD redelivery scam SMS again — different short URL but same template (35 Kč fee, fake card form).',
    category: 'online_fraud',
    urgency: 6,
    urgency_reason: 'Domain rotation, persistent campaign',
    status: 'ready',
    location: 'Online',
    entities: [],
    cluster_key: 'dpd-phish',
    created_minutes_ago: 60 * 24,
  },
  {
    text: 'Reported the same DPD phishing SMS — finally got a confirmation back from the carrier that the URL is taken down. Tracking it as resolved.',
    category: 'online_fraud',
    urgency: 4,
    urgency_reason: 'Older instance, mitigation in progress',
    status: 'actioned',
    location: 'Online',
    entities: [],
    cluster_key: 'dpd-phish',
    created_minutes_ago: 60 * 24 * 6,
  },
]

// ─── Cluster: pickpocket team on tram 22 ──────────────────────────
const PICKPOCKET_CLUSTER: Seed[] = [
  {
    text: 'Three-person team working tram 22 between Malostranská and Pražský hrad. Distractor blocks the door, two others lift wallets in the crush.',
    category: 'other',
    urgency: 6,
    urgency_reason: 'Coordinated team, tourist-heavy route, repeat behavior',
    status: 'ready',
    location: 'Tram 22 · Malostranská',
    entities: [
      { type: 'place', name: 'Tram 22', confidence: 0.95 },
      { type: 'place', name: 'Malostranská', confidence: 0.92 },
    ],
    cluster_key: 'pickpocket-22',
    created_minutes_ago: 60 * 2,
  },
  {
    text: 'Tram 22, just before Hradčanská. Lost my phone in less than a minute. Saw two men working with a woman who blocked the aisle.',
    category: 'other',
    urgency: 5,
    urgency_reason: 'Same line, similar team composition',
    status: 'ready',
    location: 'Tram 22 · Hradčanská',
    entities: [],
    cluster_key: 'pickpocket-22',
    created_minutes_ago: 60 * 9,
  },
]

// ─── Standalone reports ────────────────────────────────────────────
const STANDALONE: Seed[] = [
  {
    text: 'Restaurant near Old Town Square added an unannounced 18% "service charge" plus a "tourist tax." Bill came to 1,400 CZK for two beers.',
    category: 'restaurant_scam',
    urgency: 5,
    urgency_reason: 'Hidden fees, no menu disclosure, tourist-targeted',
    status: 'ready',
    location: 'U Tří Kohoutů',
    entities: [{ type: 'business', name: 'U Tří Kohoutů', confidence: 0.7 }],
    created_minutes_ago: 90,
  },
  {
    text: 'Fake police officer asked to see my passport and wallet near Můstek metro. Tried to slip a 500 Kč bill out before I noticed. No badge number visible.',
    category: 'other',
    urgency: 8,
    urgency_reason: 'Impersonating police, theft attempted',
    status: 'ready',
    location: 'Můstek',
    entities: [{ type: 'place', name: 'Můstek', confidence: 0.93 }],
    created_minutes_ago: 60 * 6,
  },
  {
    text: 'Online ad for cheap apartment rentals near Wenceslas Square asks for a deposit by crypto before any viewing. Address is fake — verified on cadastre.',
    category: 'online_fraud',
    urgency: 6,
    urgency_reason: 'Crypto-only deposit, fake address, listing still active',
    status: 'ready',
    location: 'Online',
    entities: [],
    created_minutes_ago: 60 * 14,
  },
  {
    text: 'Souvenir shop on Mostecká using "tax-free" stickers but adds 21% "tourist tax" at checkout. No actual tax-free certificate.',
    category: 'restaurant_scam',
    urgency: 3,
    urgency_reason: 'Misleading signage, low individual loss',
    status: 'archived',
    location: 'Mostecká',
    entities: [],
    created_minutes_ago: 60 * 24 * 7,
  },
]

const ALL_SEEDS: Seed[] = [
  ...TAXI_CLUSTER,
  ...EXCHANGE_CLUSTER,
  ...TRDELNIK_CLUSTER,
  ...DPD_CLUSTER,
  ...PICKPOCKET_CLUSTER,
  ...STANDALONE,
]

async function clearPrevious() {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('business_name', SEED_MARKER)
  if (error) throw error
  console.log('  cleared previous seed data')

  // Orphaned clusters (canonical_report_id was just deleted)
  await supabase.from('report_clusters').delete().not('id', 'is', null)
}

async function seed() {
  console.log('Seeding…')
  await clearPrevious()

  if (process.argv.includes('--clear')) {
    console.log('Clear-only mode. Done.')
    return
  }

  // Bucket seeds by cluster_key so we can wire up report_clusters
  const byCluster = new Map<string, Seed[]>()
  const standalone: Seed[] = []
  for (const s of ALL_SEEDS) {
    if (s.cluster_key) {
      const arr = byCluster.get(s.cluster_key) ?? []
      arr.push(s)
      byCluster.set(s.cluster_key, arr)
    } else {
      standalone.push(s)
    }
  }

  // Insert standalone first (no cluster involvement)
  const standaloneRows = standalone.map((s) => ({
    text_description: s.text,
    transcript:       s.text,
    business_name:    SEED_MARKER,
    location:         s.location,
    category:         s.category,
    urgency_score:    s.urgency,
    urgency_reason:   s.urgency_reason,
    status:           s.status,
    entities:         s.entities,
    created_at:       new Date(Date.now() - s.created_minutes_ago * 60_000).toISOString(),
  }))

  if (standaloneRows.length) {
    const { error } = await supabase.from('reports').insert(standaloneRows)
    if (error) throw error
    console.log(`  inserted ${standaloneRows.length} standalone reports`)
  }

  // For each cluster: insert reports, create cluster row, point them at it
  let clusterCount = 0
  let memberCount = 0
  for (const [key, members] of byCluster.entries()) {
    // Insert members first (no cluster_id yet)
    const rows = members.map((s) => ({
      text_description: s.text,
      transcript:       s.text,
      business_name:    SEED_MARKER,
      location:         s.location,
      category:         s.category,
      urgency_score:    s.urgency,
      urgency_reason:   s.urgency_reason,
      status:           s.status,
      entities:         s.entities,
      created_at:       new Date(Date.now() - s.created_minutes_ago * 60_000).toISOString(),
    }))
    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert(rows)
      .select('id, created_at')
    if (insertErr || !inserted) throw insertErr ?? new Error('insert returned no rows')

    // Canonical = oldest member (earliest created_at)
    const sorted = [...inserted].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const canonical = sorted[0]

    const { data: cluster, error: clusterErr } = await supabase
      .from('report_clusters')
      .insert({
        canonical_report_id: canonical.id,
        report_count:        inserted.length,
      })
      .select('id')
      .single()
    if (clusterErr || !cluster) throw clusterErr ?? new Error('cluster insert returned nothing')

    // Wire all members to this cluster
    const ids = inserted.map((r) => r.id)
    const { error: linkErr } = await supabase
      .from('reports')
      .update({ cluster_id: cluster.id })
      .in('id', ids)
    if (linkErr) throw linkErr

    console.log(`  cluster "${key}" → ${inserted.length} reports`)
    clusterCount += 1
    memberCount += inserted.length
  }

  // Print a summary
  console.log('')
  console.log('Seed complete:')
  console.log(`  ${standaloneRows.length} standalone + ${memberCount} clustered = ${standaloneRows.length + memberCount} reports`)
  console.log(`  ${clusterCount} clusters`)
  console.log(`  status mix: ready / actioned / archived all represented`)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
