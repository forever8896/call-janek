# Call Janek — expo-rubes

> **Made for Honest Guide (Janek Rubes)**

A mobile app that turns a flood of email tips into a triaged, deduplicated, AI-enriched report queue for an investigative journalist.

## Product context

**Janek Rubes** is an investigative journalist who hunts scammers and helps their victims — both physically in Prague (taxi/exchange/menu scams, etc., his "Honest Guide" beat) and online (cybercrime). Today the public reports tips to him via a single email address, which is overflowing with spam, duplicates, and noise. He cannot keep up; signal is buried.

**Our solution** is a single Expo app with two completely different experiences gated by role:

### Reporter experience (the public)
- Voice-first intake powered by **Whisper** → transcript pre-fills a structured problem form.
- Form fields: description (text/voice), optional image/video attachment, location/business if applicable.
- On submit, the report enters a server-side **AI pipeline** (see below) before Janek ever sees it.

### Janek experience (admin)
- Signs in with an admin account.
- Sees only post-pipeline reports: segmented by category, sorted by urgency, deduplicated, with web-search evidence already attached.
- Each report is a clickable detail view with full context (transcript, media, similar prior reports, web findings).
- Goal: replace inbox triage with a curated queue.

## Server-side AI pipeline

Runs on every new submission, in order:

1. **Spam filter** — drop obvious spam before doing any expensive work.
2. **Duplicate detection** — compare against existing reports; cluster, don't duplicate.
3. **Categorization** — type/nature of the report (taxi scam, fake exchange, online fraud, etc.).
4. **Urgency scoring** — so Janek can sort by what matters now.
5. **Entity extraction** — pull out place / location / business mentions.
6. **Web research** — for reports tied to a specific place or business, search the web for corroborating evidence and attach findings to the report.

Output: a structured, scored, enriched report ready for Janek's queue.

## Architecture

- **Mobile client**: Expo (SDK 54) + expo-router + TypeScript + new architecture. Cross-platform (iOS + Android) from one codebase; EAS Update for OTA JS fixes without app-store review.
- **Backend platform**: **Supabase** — managed Postgres (persistence + queue substrate), auth, storage (media), Row-Level Security (role enforcement), Realtime (worker wake-up).
- **Pipeline worker**: small **Bun + Hono** service that runs the AI pipeline. Polls Supabase or subscribes via Realtime for new `queued` reports, processes step-by-step, updates row state.
- **Queue**: **Postgres-backed, no Redis.** Start with a `reports.status` column (`queued` → `processing` → `done`/`failed`) and a `pipeline_runs` table for per-step state. Swap in `pg-boss` or `river` if/when retries + scheduled jobs + DLQ get painful to hand-roll. Reach for Redis only if volume forces sub-100ms job pickup — Janek's tip volume won't.
- **AI**: LLMs for spam/dedupe/categorization/urgency/entity-extraction; **Whisper** for voice transcription (server-side via Supabase storage upload → worker transcribes → response); web-search tool for evidence gathering.
- **Auth**: role-based via Supabase Auth — `reporter` (public, possibly anonymous) vs `admin` (Janek). RLS policies enforce "admin sees all reports, reporter sees only their own." Two distinct UI flows from a single binary, gated at the route-group layout level.

### Why these choices

- **Expo over Swift/native**: reporters span iOS + Android; native UI surface is mundane (audio record, media pick, network); EAS Update is operationally critical for a journalist's tool that may need a fast fix under public scrutiny.
- **Supabase over self-hosted Postgres**: deletes a chunk of plumbing (auth, storage, RLS, dashboard) so engineering hours go into the pipeline — which is the actual product. Vendor coupling is acceptable; Postgres is portable if we ever migrate out.
- **Bun/Hono worker over Supabase Edge Functions for the pipeline**: pipeline steps need long timeouts (web research can be 10–30s), full LLM SDK control, and easier local dev. Edge Functions are fine for short request/response work but a poor fit for multi-step jobs.
- **No Redis**: Postgres-as-queue is ~100 LOC and zero extra infra at our volume. Adding Redis is a future swap, not a day-1 dependency.

> The Supabase backend and Bun/Hono pipeline worker are not yet scaffolded in this repo — only the Expo client. Build the schema + worker before adding client features that assume a server contract.

## Toolchain

- Package manager: **bun** (not npm/yarn)
- Node: v22.x
- EAS CLI: globally installed via bun (`~/.bun/bin/eas`)
- Editor: Cursor / VS Code

## EAS

- Logged-in user: `kiliansolutions` (kilianvaldman@gmail.com)
- Accessible accounts: `kiliansolutions`, `danian_org`
- Verify with `eas whoami`

## Common commands

```bash
bun install                 # install deps
bun expo start              # dev server (Metro)
bun run android | ios | web # platform-specific dev
bun run lint                # expo lint

eas build:configure                                    # one-time, creates eas.json
eas build --profile development --platform android|ios # dev client build
eas build --profile production --platform android|ios  # store build

eas update:configure                # one-time
eas update --channel production     # OTA update
```

## Expo MCP

The Expo MCP server is registered at project scope in `.mcp.json` and points at `http://localhost:8081` (Metro's default). It attaches to a **running Expo dev server**, so the start order is:

1. `bun expo start` — leave it running (gives you `http://localhost:8081` by default).
2. Restart Claude Code in this directory so it re-reads `.mcp.json` and connects.

If `claude mcp list` shows `expo: ✗ Failed to connect`, it's almost always because the dev server isn't running yet. Start Metro first, then restart Claude. If you run Metro on a non-default port, update the `--dev-server-url` arg in `.mcp.json` to match.

## Project layout (current — default expo-router template)

- `app/` — file-based routes (will split into `(reporter)` and `(admin)` route groups)
- `components/` — shared UI
- `hooks/`, `constants/` — utilities
- `assets/images/` — icons, splash
- `app.json` — Expo config (name/slug/scheme: `expo-rubes`, `expo-rubes`, `exporubes`)

## Conventions

- Use **bun** for all package operations (`bun add`, `bun remove`, never `npm i`).
- Use **expo install** for adding Expo/RN libraries so version-pinning matches the SDK: `bun expo install <pkg>`.
- New routes: add files under `app/`. Typed routes are enabled (`experiments.typedRoutes: true`).
- Two-experience UX: split routes by role group (e.g. `app/(reporter)/...` vs `app/(admin)/...`) and gate at the layout level — don't conditionally render inside shared screens.
- Voice/whisper code path should be the **default** intake on the reporter side; manual typing is a fallback, not the primary flow.
- Keep `app.json` `slug` and `scheme` consistent if renaming the app.

## Setup history (one-time, already done)

1. Installed EAS CLI: `bun install -g eas-cli`
2. Scaffolded: `bunx create-expo-app@latest . --template default --no-install`
3. Renamed `expo-rubes-scaffold` → `expo-rubes` in `package.json` + `app.json` (name/slug/scheme).
4. Registered Expo MCP at project scope: `claude mcp add expo --scope project -- bunx -y expo-mcp@latest`
5. `eas login` (as `kiliansolutions`)
6. `bun install` — 858 packages installed, `bun.lock` generated.

## Next setup steps (when ready)

- `eas build:configure` to generate `eas.json`.
- First development build: `eas build --profile development --platform android` (or `ios`).
- After build installs on a device: `bun expo start --dev-client`.
- For production: `eas build --profile production --platform android|ios`.
- For OTA updates: `eas update:configure` then `eas update --channel production`.
- Expo Agent access: add username to the Expo Agent Access doc, then use `agent.expo.dev`.
- Discount: build coupon code `STRV19`.

## Backend / pipeline — to scaffold

Stack chosen (above); concrete shape:

- **Supabase project**: one project for the whole app. Local dev via `supabase` CLI + Docker, production on Supabase Cloud.
- **Postgres schema** (managed via Supabase migrations):
  - `reports` — id, reporter_id (nullable for anon), description, transcript, status, urgency, category, cluster_id, demo_run_id (nullable, for demo fixture isolation), created_at, updated_at
  - `report_media` — id, report_id, storage_path, kind (image|video|audio), mime_type
  - `report_clusters` — id, canonical_report_id, summary (groups duplicates)
  - `evidence` — id, report_id, source_url, snippet, fetched_at (web-research output)
  - `pipeline_runs` — id, report_id, step, status, started_at, finished_at, error (per-step audit + retry state)
  - `categories` — seed table of report types
  - `audit_log` — admin actions for traceability
- **Storage**: Supabase Storage buckets — `voice/` (audio for Whisper), `media/` (images/video). Reporter uploads via signed URLs; worker reads server-side.
- **Auth**: Supabase Auth. Anonymous sign-in for reporters (single device-bound session). Admin (Janek) gets a magic-link or passkey login; admin role flagged via Supabase custom claim or `admin_users` table. RLS:
  - `reports`: reporter can `insert` + `select` own; admin can `select` all.
  - `evidence` / `pipeline_runs`: admin-only.
- **Pipeline worker** (`worker/` dir, separate package or repo):
  - Bun + Hono.
  - On report insert (`status='queued'`), pick up via Postgres LISTEN/NOTIFY or Supabase Realtime subscription, fall back to a 5s poll.
  - Steps run in order **per report**: spam → dedupe → categorize → urgency → entity extraction → web research. Each step is a row in `pipeline_runs` so a failure restarts at the failed step, not the whole pipeline.
  - **Concurrent across reports** from day one: capped pool of 8–12 in-flight steps. A serial worker can't produce the visible-flood effect the demo depends on.
  - Whisper: invoked from worker after audio upload completes. Transcript written back to `reports.transcript`, then status flips to `queued` for the LLM steps.
- **Worker hosting**: any process host (Fly.io / Railway / Render / a small VPS). One worker is enough at our volume.
- **Promotion gate**: `reports` rows are only visible to admin queue **after** spam + dedupe steps complete. Enforce via `status` column + RLS, not at the client.
- **Fixture generator** (`worker/fixtures/` or similar): generates believable Czech/Prague scam reports (taxi, exchange, menu, online fraud) with intentional dupes/clusters. Run once to produce a JSON corpus that's checked in; demo loads from it.

## Demo plan — the killer moment

The pitch demo's job is to make "noise → triaged signal" visceral in ~60 seconds: a flood of incoming reports on one side, Janek's queue self-organizing on the other. **Real pipeline, real LLM calls — no scripted replays.**

### Sizing

- **Burst:** ~100–150 fixture reports dripped in over 60s (~2/sec). Big enough to feel like a flood, small enough that the worker makes visible progress.
- **Worker concurrency:** 8–12 in-flight pipeline steps. Looks busy, stays under any LLM rate limit.
- **Pre-seeded corpus:** 200–500 historical reports inserted before the demo starts so the dedup step has a real backlog to match against. Without this, clusters never form and the panel looks dead.
- **Burst composition:** ~20% spam, ~30% obvious dupes of seeded reports, ~50% fresh. Every pipeline step then does visible work on stage.
- It is *fine* (and more honest) for the demo to end with some reports still `processing`. The story is the *flow*, not an empty queue.

### Visual targets in the admin UI

The three things that have to land:
1. Three counters ticking in different rhythms — **incoming / processing / triaged**.
2. **Category bars** filling live as categorization completes.
3. **Urgency-sorted queue** visibly reordering as urgency scores arrive; **clusters merging** in place when dedup hits.

Animate transitions, don't just re-render. The UI subscribes to Supabase Realtime on the same tables the worker writes to, so demo and prod code paths are identical.

### Constraints this places on the rest of the build

- `reports.demo_run_id` (nullable) lets seeded + burst rows be flagged and reset between runs without nuking real data. In the schema from day one.
- Worker concurrency from day one (above). Don't ship a serial MVP and try to retrofit.
- Admin UI is **Realtime-first** from day one — Supabase subscriptions, optimistic local state for animation. Don't build a polling MVP and try to swap.
- Fixture generator is its own tool (above), separate from runtime code paths.

### Open decision

How is the burst triggered?
- **In-app demo button** on the admin screen — most impressive on stage, but bakes demo plumbing into the production binary.
- **Out-of-band CLI** (`bun run demo:burst` from the presenter's laptop) — keeps the app clean, easy to control timing, requires laptop on stage.

Default to CLI unless we have a reason otherwise; revisit before the worker is built.

## Things NOT to do

- Don't commit `.env` or any file containing secrets.
- Don't add an Anthropic API key or `apiKeyHelper` to this project's settings (user opted out).
- Don't switch package managers — stick to bun.
- Don't expose admin routes/data to reporter sessions even client-side — gate at the layout, not at the screen.
- Don't show a report to Janek before it has cleared the spam + dedupe steps of the pipeline.
