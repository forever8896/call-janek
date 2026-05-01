// Stage demo: drip a flood of raw `status='queued'` reports into the DB so the
// worker pipeline + admin dashboard light up in real time.
//
//   bun run scripts/burst.ts                    # default: 100 reports over 60s
//   bun run scripts/burst.ts --count=50         # 50 reports
//   bun run scripts/burst.ts --duration=30      # over 30 seconds
//   bun run scripts/burst.ts --rate=4           # 4 reports/sec (overrides --duration)
//   bun run scripts/burst.ts --clear            # delete previous burst, no insert
//
// Marker: every burst report's business_name is set to '__burst__' so a re-run
// (or --clear) can wipe them without touching the seed corpus or real data.
//
// Composition: ~50% fresh tips, ~30% dupes that overlap seed clusters
// (taxi 4AM, Václavské exchange, Karlův most trdelník, DPD phishing, tram 22),
// ~20% obvious spam. Tips are intentionally a mix of concrete (named address,
// plate, domain) and vague (a guy on the street) so the LLM web-research gate
// has both kinds to decide on.

import { createClient } from '@supabase/supabase-js'
import { env } from '../src/lib/env'
import type { Database } from '../src/types/db'

const BURST_MARKER = '__burst__'

const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Tip = {
  text: string
  // Used only for human readability of the bucket; the pipeline re-derives this.
  expected_kind: 'fresh' | 'dupe' | 'spam'
  // Hint for what the gate should do. The pipeline doesn't read this; it's
  // here so we can sanity-check the gate against fixture intent in logs.
  research_hint: 'concrete' | 'vague' | 'n/a'
}

// ─── Dupes — overlap deliberately with seed clusters ─────────────────
const DUPES: Tip[] = [
  // taxi-4AM cluster (silver Škoda, plate 4AM)
  { text: 'Another silver Škoda taxi from the Old Town with plate starting 4AM. Charged 1,650 CZK to Vinohrady. Driver said meter was broken, no receipt.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'Picked up at Náměstí Republiky by a silver Škoda taxi, no rooftop sign. Plate 4AM-5102. Quoted 1,900 Kč for a 3 km ride.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'My friend got into the same scam silver Škoda last night from Old Town Square. Charged 2,000 CZK, refused card payment.', expected_kind: 'dupe', research_hint: 'vague' },
  // exchange-vaclavak cluster (Václavské náměstí 32, "Exchange Centrum Praha")
  { text: 'Same fake exchange booth on Václavské náměstí 32 — got Belarusian rubles instead of EUR again. They posted 0% commission.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'Exchange near Můstek metro on Václavák handed me BYR instead of euros. Lost 220 EUR. The booth is named Exchange Centrum Praha.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'Currency exchange somewhere on Václavské náměstí ripped off a tourist with a 35% spread. No name visible on the booth.', expected_kind: 'dupe', research_hint: 'vague' },
  // trdelnik-charles cluster (Křižovnická 3, near Charles Bridge)
  { text: 'Trdelník stand on Křižovnická 3 still selling at 350 Kč. No menu, no prices. Lots of confused tourists paying.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'Charged 380 CZK for a single trdelník near Karlův most. Owner refused to give a receipt or a price list.', expected_kind: 'dupe', research_hint: 'vague' },
  // dpd-phish cluster (DPD redelivery SMS)
  { text: 'DPD redelivery SMS again — bit.ly/dpd-cz this time, asking 35 Kč. Form harvests full card details and CVV. Same template as last week.', expected_kind: 'dupe', research_hint: 'concrete' },
  { text: 'My mum got the DPD 35 Kč redelivery scam. The link bounced through dpd-cz.live before the card form. She entered details before realising.', expected_kind: 'dupe', research_hint: 'concrete' },
  // pickpocket-22 cluster (tram 22)
  { text: 'Tram 22 between Malostranská and Pražský hrad — same three-person crew working the doors. Saw them lift two wallets in five minutes.', expected_kind: 'dupe', research_hint: 'vague' },
  { text: 'Lost my phone on tram 22 today, woman blocked the aisle, two men crowded me at the doors. Same MO as the reports last month.', expected_kind: 'dupe', research_hint: 'vague' },
]

// ─── Fresh — new clusters or one-offs, mix of concrete + vague ───────
const FRESH: Tip[] = [
  // Concrete (researchable) — has named business / address / domain / plate
  { text: 'Money exchange called "Praha Change" at Národní 25 advertised 24.5 CZK/EUR but charged 38% spread. Receipt shows business ID 11223344.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Restaurant U Modré Kachničky on Nebovidská 6 added a 22% "tourist service" charge not on the menu. Bill came to 4,200 CZK for two mains.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Phishing site ceska-posta-doplatek.com pretending to be Česká pošta, asking 49 Kč redelivery fee. Card form is fake. Domain registered 3 days ago.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Massage parlour on Soukenická 8 advertised 600 Kč per hour, charged 3,500 Kč after the session. Owner physically blocked the door until paid.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Taxi stand outside Florenc bus station — driver of plate 1AT-9921 quoted 1,200 Kč to Smíchov for 4 km. White Octavia, no rooftop sign.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Hotel booking on the domain praguestay-deals.cz — paid 8,000 Kč deposit, hotel does not exist. Reverse-image search shows photos stolen from a real Vienna hotel.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Crypto ATM at Wenceslas Square 56 charging 18% fee instead of the 6% advertised. Operator: BitPraha s.r.o.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Souvenir shop "Bohemia Crystal Center" on Pařížská 12 selling Chinese imports as "Czech crystal" with fake authenticity certificates.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Fake parking inspector at Náměstí Míru — fluorescent vest, no badge, demanded 800 Kč cash for an "unpaid ticket." Walked off when I offered to call police.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Online ad on Sbazar.cz selling iPhone 15 for 8,000 Kč — seller asks payment via Revolut to a Lithuanian IBAN before any meeting. Listing user: martin_pha_2024.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Tourist information booth at Hlavní nádraží sells "city passes" for 2,400 Kč that turn out to be photocopies. The booth has no signage and no business ID.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Casino on Štěpánská 33 — staff swapped a 5,000 Kč chip for a 500 Kč one when cashing out. Camera footage was "unavailable."', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'WhatsApp message claiming to be a CSOB bank fraud team, asking for SMS code to "block a fraudulent transfer." Number +420 778 451 209.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Booth at the Christmas market on Staroměstské náměstí selling "horký med" in 0.2 L cups for 280 Kč. No price list visible until you order.', expected_kind: 'fresh', research_hint: 'concrete' },

  // Vague (NOT researchable — generic, no concrete identifier)
  { text: 'A guy on the street near Charles Bridge was offering exchange rates that seemed too good. Walked off when I asked for ID.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Some restaurant in the Old Town added a "service charge" I did not agree to. Did not get the name.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'A taxi tried to overcharge me from the airport. I do not remember the plate. Driver was middle-aged.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Got pickpocketed on the metro red line between Florenc and Hlavní nádraží. Did not see who did it.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Some stranger handed my friend a "free" rose then demanded 300 Kč. Happens a lot near the bridge.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'A souvenir shop somewhere off the main square charged me 600 Kč for a magnet. Forgot which one.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Random WhatsApp message from a +420 number asking me to verify my bank account. Deleted it.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Trdelník somewhere near the bridge was 280 Kč. Multiple stands, did not note which.', expected_kind: 'fresh', research_hint: 'vague' },

  // Higher-urgency one-offs (keeps the urgency-sort visible)
  { text: 'My grandfather, 78, just paid 12,000 Kč to a "technician" claiming to be from O2 saying his router was hacked. The man came to his apartment in Žižkov and took the cash. Description: tall, 30s, dark jacket, fake O2 lanyard.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Fake police at Můstek demanded passport AND wallet, took 4,000 Kč in cash before I could react. Two men, one in fake uniform with no badge number.', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Domain dpd-redelivery-cz.shop is harvesting cards right now — the form auto-submits to a Telegram bot. Active campaign, dozens of victims in the last 24h based on Reddit r/Czech.', expected_kind: 'fresh', research_hint: 'concrete' },

  // Mid-urgency
  { text: 'Currency exchange near Náměstí Republiky metro entrance offered 22 CZK/EUR after I had already given them 200 EUR. They claimed the posted board "was the buy rate."', expected_kind: 'fresh', research_hint: 'vague' },
  { text: 'Bar on Dlouhá 16 added a 200 Kč "music fee" per person at the end. No mention of it on entry or in the menu.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Got a "DPD redelivery" email this time (not SMS), link goes to dpd-czech-redelivery.com. Same card-harvest pattern.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Cleaning company "Praha Clean Pro" on Sezimova 4 took a 5,000 Kč deposit and never showed up. Phone goes straight to voicemail.', expected_kind: 'fresh', research_hint: 'concrete' },
  { text: 'Guy at the airport approached me offering "official taxi" for 2,500 Kč to the city. Lead me to an unmarked black sedan, no meter.', expected_kind: 'fresh', research_hint: 'vague' },
]

// ─── Spam — clear noise that should be filtered out before Janek sees it ──
const SPAM: Tip[] = [
  { text: 'CONGRATULATIONS!! You have won 1,000,000 USD in the Microsoft lottery. Click here to claim: bit.ly/ms-prize-cz', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'asdfghjkl asdf asdf test test test', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'Hello dear, my name is Mrs. Patricia and I have $2.5 million USD to transfer to your country, please help me.', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'BUY CHEAP RAYBANS 90% OFF HOT DEAL CLICK HERE NOW NOW NOW', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'Hi I love your work please reply with your phone number so we can talk privately about a business opportunity', expected_kind: 'spam', research_hint: 'n/a' },
  { text: '🚀🚀🚀 Crypto pump signal — buy $XYZCOIN before midnight, 100x guaranteed 🚀🚀🚀', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'aaaaaaaaaa', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'just testing if this form works', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'Janek you are amazing, keep up the good work, no scam to report just love from Brno!', expected_kind: 'spam', research_hint: 'n/a' },
  { text: 'is this where i complain about the weather it is too hot today', expected_kind: 'spam', research_hint: 'n/a' },
]

const ALL_TIPS: Tip[] = [...DUPES, ...FRESH, ...SPAM]

// ─── CLI parsing ─────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const get = (key: string) => {
    const m = args.find((a) => a.startsWith(`--${key}=`))
    return m ? m.split('=')[1] : undefined
  }
  return {
    count:    Number(get('count')    ?? 100),
    duration: Number(get('duration') ?? 60),     // seconds
    rate:     get('rate') ? Number(get('rate')) : undefined, // overrides duration
    clear:    args.includes('--clear'),
  }
}

async function clearPrevious() {
  const { error, count } = await supabase
    .from('reports')
    .delete({ count: 'exact' })
    .eq('business_name', BURST_MARKER)
  if (error) throw error
  console.log(`  cleared ${count ?? 0} previous burst reports`)
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function burst() {
  const { count, duration, rate, clear } = parseArgs()
  console.log('Bursting…')
  await clearPrevious()

  if (clear) {
    console.log('Clear-only mode. Done.')
    return
  }

  // Build the burst payload by sampling from the three buckets to roughly
  // hit the 50/30/20 fresh/dupe/spam mix CLAUDE.md asks for. Even at small
  // counts the proportions stay close.
  const targetFresh = Math.round(count * 0.5)
  const targetDupe  = Math.round(count * 0.3)
  const targetSpam  = count - targetFresh - targetDupe

  const pickN = (pool: Tip[], n: number) => {
    const shuffled = shuffle(pool)
    const out: Tip[] = []
    while (out.length < n) {
      out.push(shuffled[out.length % shuffled.length])
    }
    return out
  }

  const payload = shuffle([
    ...pickN(FRESH, targetFresh),
    ...pickN(DUPES, targetDupe),
    ...pickN(SPAM,  targetSpam),
  ])

  const intervalMs = rate
    ? Math.round(1000 / rate)
    : Math.round((duration * 1000) / count)

  console.log(`  ${count} reports over ${rate ? `${rate}/s` : `${duration}s`} → 1 every ${intervalMs}ms`)
  console.log(`  mix: ${targetFresh} fresh / ${targetDupe} dupe / ${targetSpam} spam`)
  console.log('')

  let i = 0
  const startedAt = Date.now()
  for (const tip of payload) {
    const { error } = await supabase.from('reports').insert({
      text_description: tip.text,
      transcript:       tip.text,
      business_name:    BURST_MARKER,
      status:           'queued',
    })
    if (error) {
      console.error(`  [${i}] insert failed:`, error.message)
    } else {
      i++
      const tag = `${tip.expected_kind.padEnd(5)} · ${tip.research_hint.padEnd(8)}`
      const preview = tip.text.length > 64 ? tip.text.slice(0, 61) + '...' : tip.text
      console.log(`  [${String(i).padStart(3)}/${count}] ${tag} | ${preview}`)
    }

    // Pace: skip the wait on the last one so the script exits promptly.
    if (i < count) await new Promise((r) => setTimeout(r, intervalMs))
  }

  const elapsedMs = Date.now() - startedAt
  console.log('')
  console.log(`Burst complete: ${i}/${count} inserted in ${(elapsedMs / 1000).toFixed(1)}s`)
  console.log('Watch the worker logs and the admin dashboard — the pipeline is processing.')
}

burst().catch((err) => {
  console.error(err)
  process.exit(1)
})
