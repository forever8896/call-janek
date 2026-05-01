# Backend Scope & Backlog — Call Janek

> Owner: BE team  
> Last updated: 2026-05-01  
> Status: Planning

---

## 1. What We Own

The Expo client is handled by the FE team. We own everything below the screen:

- **Supabase project** — schema, migrations, RLS policies, storage buckets, auth config, Realtime
- **Pipeline worker** — Bun + Hono service; processes every incoming report through 6 AI steps
- **Shared TypeScript types** — single source of truth for request/response shapes used by both teams
- **API contract** — documented, versioned, stable

FE depends on us. We ship first, or at minimum in parallel with a stable contract.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Expo Client (FE)                   │
│  Reporter UI          │          Admin UI (Janek)    │
└──────────┬────────────┘──────────────┬───────────────┘
           │ REST + Supabase SDK        │ REST + Supabase Realtime
           ▼                           ▼
┌─────────────────────────────────────────────────────┐
│              Bun + Hono API Worker                   │
│  /reports  /reports/audio  /admin/*  /internal/*     │
└──────────────────────┬──────────────────────────────┘
                       │ service key (bypass RLS)
                       ▼
┌─────────────────────────────────────────────────────┐
│                    Supabase                          │
│  Postgres + pgvector  │  Auth  │  Storage  │Realtime │
└─────────────────────────────────────────────────────┘
                       │
           ┌───────────┼──────────────┐
           ▼           ▼              ▼
      Anthropic    OpenAI          Tavily
      (Claude)    (Whisper +      (web search)
                  embeddings)
```

### Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Queue | Postgres (`pipeline_runs` table) | Zero extra infra at our volume; swap to pg-boss if it gets painful |
| No Redis | Confirmed | Overkill for <1000 reports/day |
| Pipeline trigger | Postgres LISTEN/NOTIFY + 5s poll fallback | Instant pickup, no polling overhead |
| LLM | Claude Haiku for pipeline steps | Fast, cheap, sufficient for classification tasks |
| Embeddings | OpenAI `text-embedding-3-small` | Claude has no embeddings API |
| Transcription | OpenAI Whisper API (`whisper-1`, lang: `cs`) | Best Czech accuracy |
| Web search | Tavily API | AI-optimized, clean content, better than raw Google |
| Deployment | Railway | Push-to-deploy, Bun runtime, simple env vars |
| Monorepo | `worker/` dir in same repo | Simpler for now; can split later |

---

## 3. Database Schema

All managed via Supabase CLI migrations. Never edit production schema by hand.

### `reports`
Core entity. Every submitted tip lives here.

```sql
create table reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  reporter_id     uuid references auth.users(id) on delete set null, -- nullable, Supabase anon session
  status          text not null default 'queued'
                  check (status in ('queued','transcribing','processing','ready','spam','quarantine','archived','actioned')),
  text_description text,          -- filled by reporter or from Whisper transcript
  transcript      text,           -- raw Whisper output (may differ from edited text_description)
  location        text,           -- optional, reporter-supplied
  business_name   text,           -- optional, reporter-supplied
  category        text check (category in ('taxi_scam','fake_exchange','online_fraud','restaurant_scam','other')),
  urgency_score   smallint check (urgency_score between 1 and 10),
  urgency_reason  text,
  cluster_id      uuid references report_clusters(id) on delete set null,
  entities        jsonb,          -- [{type, name, address?}] from entity extraction step
  pipeline_started_at  timestamptz,
  pipeline_completed_at timestamptz
);

create index reports_status_idx on reports(status);
create index reports_urgency_idx on reports(urgency_score desc) where status = 'ready';
create index reports_cluster_idx on reports(cluster_id) where cluster_id is not null;
create index reports_created_idx on reports(created_at desc);
```

**Status flow:**
```
queued ──────────────────────────────────────────► ready      (Janek sees this)
  │                                                    ▲
  ├─► transcribing ──► queued (after Whisper done)     │
  │                                                    │
  └─► processing ──────────────────────────────────────┘
           │
           ├─► spam         (silent drop, reporter never knows)
           └─► quarantine   (uncertain spam, Janek decides)
```

### `report_media`
Photos, videos, and audio attachments. Audio is media like anything else.

```sql
create table report_media (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  storage_path text not null,   -- Supabase Storage path, e.g. media/abc123.jpg
  kind         text not null check (kind in ('image','video','audio')),
  mime_type    text not null,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index report_media_report_idx on report_media(report_id);
```

### `pipeline_runs`
Per-step audit trail and retry state. This is our queue — no Redis needed.

```sql
create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  step         text not null check (step in ('spam','dedupe','category','urgency','entities','web_research','whisper')),
  status       text not null default 'pending'
               check (status in ('pending','running','done','failed','skipped')),
  result       jsonb,          -- structured output of the step
  attempts     smallint not null default 0,
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text
);

create index pipeline_runs_report_idx on pipeline_runs(report_id);
create index pipeline_runs_failed_idx on pipeline_runs(status) where status = 'failed';
```

### `report_clusters`
Groups of duplicate/similar reports. Deduplication clusters, never deletes.

```sql
create table report_clusters (
  id                    uuid primary key default gen_random_uuid(),
  canonical_report_id   uuid not null references reports(id) on delete restrict,
  report_count          int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
```

### `report_embeddings`
Vector representations for semantic duplicate detection. Requires pgvector.

```sql
create extension if not exists vector;

create table report_embeddings (
  report_id   uuid primary key references reports(id) on delete cascade,
  embedding   vector(1536) not null,   -- OpenAI text-embedding-3-small dimensionality
  created_at  timestamptz not null default now()
);

create index report_embeddings_vec_idx
  on report_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);
```

### `evidence`
Web research findings attached to a report.

```sql
create table evidence (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references reports(id) on delete cascade,
  source_url       text not null,
  title            text,
  snippet          text,
  relevance_score  real check (relevance_score between 0 and 1),
  fetched_at       timestamptz not null default now()
);

create index evidence_report_idx on evidence(report_id);
```

### `categories` (seed table)

```sql
create table categories (
  id       text primary key,  -- same as enum value
  label_cs text not null,     -- Czech label for UI
  label_en text not null
);

insert into categories values
  ('taxi_scam',     'Taxikářský podvod',    'Taxi scam'),
  ('fake_exchange', 'Falešná směnárna',     'Fake exchange'),
  ('online_fraud',  'Online podvod',         'Online fraud'),
  ('restaurant_scam','Podvod v restauraci', 'Restaurant scam'),
  ('other',         'Jiné',                  'Other');
```

### `audit_log`
Admin actions. Append-only, never delete.

```sql
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,   -- e.g. 'report.viewed', 'report.actioned', 'quarantine.approved'
  target_id  uuid,            -- report_id or other entity
  meta       jsonb
);
```

---

## 4. Row Level Security

The worker uses the **service role key** (bypasses RLS). The Expo client uses the **anon key** (subject to RLS). Client never calls our API with a service key.

```sql
-- reporters can insert reports and see only their own
alter table reports enable row level security;

create policy "reporter_insert" on reports
  for insert with check (auth.uid() = reporter_id or reporter_id is null);

create policy "reporter_select_own" on reports
  for select using (auth.uid() = reporter_id);

-- admin sees all reports that cleared spam+dedupe
create policy "admin_select_all" on reports
  for select using (
    exists (select 1 from auth.users where id = auth.uid() and raw_user_meta_data->>'role' = 'admin')
  );

-- evidence, pipeline_runs, audit_log: admin only
alter table evidence enable row level security;
create policy "admin_only" on evidence for all
  using (exists (select 1 from auth.users where id = auth.uid() and raw_user_meta_data->>'role' = 'admin'));

-- same pattern for pipeline_runs, report_clusters, audit_log
```

---

## 5. Storage Buckets

| Bucket | Access | Contents |
|---|---|---|
| `media` | Private, presigned upload | Reporter photos and videos |
| `voice` | Private | Audio recordings (Whisper input) |

Reporter uploads directly to Supabase Storage via a presigned URL issued by our API. Worker reads files server-side via service key. Our API never proxies large file bytes.

---

## 6. Auth Model

| Actor | Method | Token |
|---|---|---|
| Reporter | `supabase.auth.signInAnonymously()` — device-bound, no registration | Supabase anon JWT, `role: reporter` |
| Janek | Magic link to `janek@honestguide.cz` | Supabase JWT, `raw_user_meta_data.role: admin` |

Admin role is set manually in Supabase dashboard on Janek's user row. No self-service admin registration.

Our API verifies JWTs using Supabase JWKS endpoint. Middleware checks `raw_user_meta_data.role === 'admin'` for protected routes.

---

## 7. API Contract

Base URL: `https://api.calljanek.com` (TBD — Railway URL)  
All responses: `Content-Type: application/json`  
All errors follow: `{ error: { code: string, message: string, details?: unknown } }`

### Standard error codes
```
VALIDATION_ERROR     400 — invalid request body
UNAUTHORIZED         401 — missing or invalid JWT
FORBIDDEN            403 — valid JWT but wrong role
NOT_FOUND            404
RATE_LIMITED         429 — too many requests
PIPELINE_ERROR       500 — internal pipeline failure
```

---

### Public endpoints (no auth)

#### `POST /reports`
Submit a text report.

```typescript
// Request
{
  text_description: string;       // min 10 chars
  location?: string;
  business_name?: string;
  media_urls?: string[];          // Supabase Storage paths from prior upload
  reporter_id?: string;           // Supabase anon session uid
}

// Response 201
{
  report_id: string;
  status: "queued";
}
```

#### `POST /reports/audio`
Upload audio → Whisper transcribes async → client polls via Realtime.

```typescript
// Request: multipart/form-data
{
  audio: File;                    // .m4a / .wav / .mp4, max 25MB
  reporter_id?: string;
}

// Response 202 — transcription started, not yet done
{
  report_id: string;
  status: "transcribing";
  audio_path: string;             // Supabase Storage path
}
// Client subscribes to Supabase Realtime on reports.id = report_id
// When status → "queued" and transcript is set, show pre-filled form
```

#### `GET /reports/upload-url`
Presigned URL for direct client → Supabase Storage upload (photos/videos).

```typescript
// Query
{ mime_type: string; kind: "image" | "video" }

// Response 200
{
  upload_url: string;             // signed upload URL, valid 60s
  storage_path: string;           // path to reference in POST /reports
}
```

---

### Admin endpoints (requires Bearer JWT with role=admin)

#### `GET /admin/reports`
Janek's queue. Only `status = ready` reports.

```typescript
// Query
{
  category?: Category;
  page?: number;                  // default 1
  limit?: number;                 // default 20, max 50
}

// Response 200
{
  reports: ReportListItem[];
  total: number;
  page: number;
  pages: number;
}

// ReportListItem
{
  id: string;
  created_at: string;
  text_description: string;       // truncated to 200 chars
  category: Category;
  urgency_score: number;
  urgency_reason: string;
  cluster_id: string | null;      // non-null = part of a duplicate group
  cluster_count: number | null;   // how many similar reports
  entity_count: number;
  evidence_count: number;
  has_media: boolean;
}
```

#### `GET /admin/reports/:id`
Full report detail.

```typescript
// Response 200
{
  id: string;
  created_at: string;
  text_description: string;
  transcript: string | null;
  location: string | null;
  business_name: string | null;
  category: Category;
  urgency_score: number;
  urgency_reason: string;
  entities: Entity[];
  media: MediaItem[];
  evidence: EvidenceItem[];
  cluster: {
    id: string;
    canonical_report_id: string;
    report_count: number;
    similar_reports: ReportListItem[];
  } | null;
  pipeline_runs: PipelineRun[];   // full step audit for debugging
}
```

#### `PATCH /admin/reports/:id`
Mark report as reviewed.

```typescript
// Request
{ status: "actioned" | "archived" }

// Response 200
{ id: string; status: string; }
```

#### `GET /admin/quarantine`
Reports with uncertain spam classification awaiting Janek's decision.

```typescript
// Response 200
{ reports: ReportListItem[]; total: number; }
```

#### `POST /admin/quarantine/:id/approve`
Janek approves: report continues pipeline from spam step.

```typescript
// Response 200
{ report_id: string; status: "processing"; }
```

#### `POST /admin/quarantine/:id/reject`
Janek rejects: report marked spam permanently.

```typescript
// Response 200
{ report_id: string; status: "spam"; }
```

---

## 8. Pipeline Design

Triggered by Postgres `LISTEN/NOTIFY` when a report enters `status = queued`. Fallback: 5s poll for `queued` reports older than 10s (catches missed notifications).

```
report.status = 'queued'
       │
       ▼
┌─────────────────────────────────────────────────┐
│ [0] whisper (only if transcript is null)        │ → writes transcript, skipped if text-only report
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ [1] spam filter                                 │ → is_spam + confidence
└────────────────────┬────────────────────────────┘
          confidence < 0.85 AND spam? → quarantine
          confidence >= 0.85 AND spam? → spam (stop)
                     ▼
┌─────────────────────────────────────────────────┐
│ [2] dedupe                                      │ → embed + cosine similarity → cluster_id
└────────────────────┬────────────────────────────┘
    (duplicate does NOT stop pipeline — just clusters)
                     ▼
┌─────────────────────────────────────────────────┐
│ [3] categorization                              │ → category
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ [4] urgency scoring                             │ → urgency_score + urgency_reason
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ [5] entity extraction                           │ → entities[]
└────────────────────┬────────────────────────────┘
         no place/business entities? → skip [6]
                     ▼
┌─────────────────────────────────────────────────┐
│ [6] web research                                │ → evidence[] (max 3 searches/report)
└────────────────────┬────────────────────────────┘
                     ▼
             status = 'ready'
        Supabase Realtime notifies Janek
```

### Retry policy
Each step: max 3 attempts, exponential backoff (1s → 4s → 9s).  
After 3 failures: `pipeline_runs.status = failed`, report stays `processing`.  
Recovery: Supabase cron (`pg_cron`) runs every 15 min — finds reports stuck in `processing` for >20 min, resets failed step to `pending` and re-triggers NOTIFY.

### Step specs

**[0] Whisper**
- Input: `report_media` row where `kind = audio`
- API: `POST https://api.openai.com/v1/audio/transcriptions`, model `whisper-1`, language `cs`
- Output: writes `reports.transcript`
- Skip condition: `reports.transcript` already set (text-only report)

**[1] Spam filter**
- Model: Claude Haiku
- Input: `text_description` + `transcript`
- Output: `{ is_spam: bool, confidence: float, reason: string }`
- Prompt language: English with explicit instruction to handle Czech/Slovak input
- Threshold: confidence ≥ 0.85 → hard spam; 0.5–0.85 → quarantine

**[2] Dedupe**
- Embed combined text (`text_description + location + business_name`) via OpenAI `text-embedding-3-small`
- Store in `report_embeddings`
- pgvector cosine similarity search: `SELECT report_id, 1 - (embedding <=> $1) AS similarity FROM report_embeddings ORDER BY embedding <=> $1 LIMIT 5`
- Threshold: similarity > 0.88 → assign existing cluster or create new one
- Does not block pipeline — only sets `cluster_id`

**[3] Categorization**
- Model: Claude Haiku
- Output: `{ category: Category, confidence: float, reasoning: string }`
- Writes `reports.category`

**[4] Urgency scoring**
- Model: Claude Haiku
- Input: text + category
- Scoring factors in prompt: financial harm, physical safety risk, number of potential victims, recency/trend, actionability for journalist
- Output: `{ score: 1-10, reason: string }`
- Writes `reports.urgency_score`, `reports.urgency_reason`

**[5] Entity extraction**
- Model: Claude Haiku
- Output: `[{ type: 'place'|'business'|'person', name: string, address?: string, confidence: float }]`
- Writes `reports.entities`

**[6] Web research**
- Runs only if entities contain `place` or `business` type
- Per entity: Tavily search query = `"{entity.name}" podvod scam Praha`
- Max 3 searches per report; max 3 results per search
- Cache: if entity name was searched in last 7 days, reuse existing `evidence` rows (skip Tavily call)
- Each result → Claude Haiku rates relevance (0–1) and extracts clean snippet
- Stores results in `evidence` table

---

## 9. Shared TypeScript Types

Lives in `worker/src/types/shared.ts`. Exported and copied/linked to FE package.

```typescript
export type ReportStatus =
  | 'queued' | 'transcribing' | 'processing'
  | 'ready' | 'spam' | 'quarantine' | 'archived' | 'actioned';

export type Category =
  | 'taxi_scam' | 'fake_exchange' | 'online_fraud'
  | 'restaurant_scam' | 'other';

export type EntityType = 'place' | 'business' | 'person';

export interface Entity {
  type: EntityType;
  name: string;
  address?: string;
  confidence: number;
}

export interface MediaItem {
  id: string;
  storage_path: string;
  kind: 'image' | 'video' | 'audio';
  mime_type: string;
  size_bytes: number | null;
}

export interface EvidenceItem {
  id: string;
  source_url: string;
  title: string | null;
  snippet: string | null;
  relevance_score: number | null;
  fetched_at: string;
}

export interface PipelineRun {
  step: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface ReportListItem {
  id: string;
  created_at: string;
  text_description: string;
  category: Category;
  urgency_score: number;
  urgency_reason: string;
  cluster_id: string | null;
  cluster_count: number | null;
  entity_count: number;
  evidence_count: number;
  has_media: boolean;
}

export interface ReportDetail extends ReportListItem {
  transcript: string | null;
  location: string | null;
  business_name: string | null;
  entities: Entity[];
  media: MediaItem[];
  evidence: EvidenceItem[];
  cluster: {
    id: string;
    canonical_report_id: string;
    report_count: number;
    similar_reports: ReportListItem[];
  } | null;
  pipeline_runs: PipelineRun[];
}

// API responses
export interface SubmitReportResponse {
  report_id: string;
  status: 'queued';
}

export interface AudioUploadResponse {
  report_id: string;
  status: 'transcribing';
  audio_path: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  storage_path: string;
}

export interface AdminQueueResponse {
  reports: ReportListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## 10. Project Structure

```
call-janek/
├── app/                        # Expo client (FE team)
├── worker/                     # Our backend
│   ├── src/
│   │   ├── index.ts            # Hono app entry, LISTEN/NOTIFY setup
│   │   ├── routes/
│   │   │   ├── reports.ts      # POST /reports, POST /reports/audio, GET /reports/upload-url
│   │   │   └── admin.ts        # GET|PATCH /admin/reports, /admin/quarantine
│   │   ├── pipeline/
│   │   │   ├── runner.ts       # orchestrates steps, retry logic
│   │   │   ├── whisper.ts      # step 0
│   │   │   ├── spam.ts         # step 1
│   │   │   ├── dedupe.ts       # step 2
│   │   │   ├── category.ts     # step 3
│   │   │   ├── urgency.ts      # step 4
│   │   │   ├── entities.ts     # step 5
│   │   │   └── web-research.ts # step 6
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client (service key)
│   │   │   ├── claude.ts       # Anthropic SDK wrapper
│   │   │   ├── openai.ts       # Whisper + embeddings wrapper
│   │   │   ├── tavily.ts       # web search wrapper
│   │   │   ├── auth.ts         # JWT verification middleware
│   │   │   └── rate-limit.ts   # IP-based rate limiter
│   │   └── types/
│   │       ├── shared.ts       # exported to FE team
│   │       └── db.ts           # generated Supabase types
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── supabase/
    ├── config.toml
    └── migrations/
        ├── 0001_initial_schema.sql
        ├── 0002_rls_policies.sql
        ├── 0003_storage_buckets.sql
        └── 0004_seed_categories.sql
```

---

## 11. Environment Variables

```bash
# worker/.env.example
SUPABASE_URL=
SUPABASE_SERVICE_KEY=        # never expose to client
SUPABASE_JWT_SECRET=         # for JWT verification

ANTHROPIC_API_KEY=           # Claude (pipeline steps)
OPENAI_API_KEY=              # Whisper + embeddings
TAVILY_API_KEY=              # web search

PORT=3000
NODE_ENV=development
```

---

## 12. Rate Limiting

In-memory (single instance). Sufficient for MVP.

| Endpoint | Limit | Window |
|---|---|---|
| `POST /reports` | 5 requests | 1 hour / IP |
| `POST /reports/audio` | 3 requests | 1 hour / IP |
| `GET /reports/upload-url` | 10 requests | 1 hour / IP |
| Admin endpoints | 200 requests | 1 hour / JWT |

---

## 13. Backlog

### Priority legend
- **P0** — blocking, must ship before FE can work
- **P1** — core functionality, MVP
- **P2** — important, ships in v1
- **P3** — nice to have, post-launch

### Story points
XS=1, S=2, M=3, L=5, XL=8, XXL=13

---

### Epic 1 — Foundation

> Goal: Worker runs locally, connects to Supabase, FE team has Supabase URL + anon key.

| # | Story | Tasks | Points | Priority |
|---|---|---|---|---|
| 1.1 | Supabase project setup | Create project on Supabase Cloud; enable pgvector; note URL + keys | S | P0 |
| 1.2 | Database migrations | Write migrations 0001–0004 (schema + RLS + storage + seed); test with `supabase db reset` | L | P0 |
| 1.3 | Worker project init | `bun init` in `worker/`; add Hono, Supabase JS, `@anthropic-ai/sdk`, `openai`; tsconfig; `.env.example` | S | P0 |
| 1.4 | Supabase client lib | `lib/supabase.ts` — service role client; typed via generated DB types (`supabase gen types typescript`) | S | P0 |
| 1.5 | Auth middleware | Verify Supabase JWT via JWKS; extract uid + role; attach to Hono context; return 401/403 on failure | M | P0 |
| 1.6 | Error handler | Global Hono error middleware; standard `ApiError` shape; log stack in dev, sanitize in prod | S | P0 |
| 1.7 | Health endpoint | `GET /health` → `{ status: "ok", version }` — Railway uses this for health checks | XS | P0 |
| 1.8 | Shared types file | Write `src/types/shared.ts`; send to FE team | M | P0 |

---

### Epic 2 — Reporter Flow

> Goal: Reporter can submit a text report and upload media. FE can build submit screen.

| # | Story | Tasks | Points | Priority |
|---|---|---|---|---|
| 2.1 | `POST /reports` | Validate body; insert row; trigger NOTIFY `new_report`; return 201 | M | P0 |
| 2.2 | `GET /reports/upload-url` | Generate Supabase Storage signed upload URL for `media/` bucket; return path | M | P0 |
| 2.3 | `POST /reports/audio` | Accept multipart audio; upload to `voice/` bucket; insert report with `status=transcribing`; trigger NOTIFY; return 202 | L | P1 |
| 2.4 | Rate limiting middleware | IP-based in-memory counter; configurable per-route limits; return 429 with retry-after header | M | P1 |
| 2.5 | Input validation | Zod schemas for all request bodies; descriptive validation errors | S | P1 |

---

### Epic 3 — Pipeline Runner

> Goal: Every queued report is processed through all 6 steps. Failures retry. Janek never sees unprocessed reports.

| # | Story | Tasks | Points | Priority |
|---|---|---|---|---|
| 3.1 | LISTEN/NOTIFY setup | `pg_notify('new_report', report_id)` on insert trigger; worker listens via Supabase Realtime or `pg` LISTEN; fallback 5s poll | M | P1 |
| 3.2 | Pipeline runner core | `runPipeline(reportId)`: fetch report; iterate steps in order; write `pipeline_runs` rows; handle skip/stop logic; set final status | XL | P1 |
| 3.3 | Retry logic | Per-step: catch error, increment attempts, exponential backoff, re-throw after 3 fails; mark step `failed` | M | P1 |
| 3.4 | Recovery cron | `pg_cron` job every 15 min: find `processing` reports >20 min old; reset failed step to `pending`; re-NOTIFY | M | P2 |
| 3.5 | Whisper step | Upload audio from Storage to Whisper API; write transcript; skip if already set | L | P1 |
| 3.6 | Spam filter step | Claude Haiku prompt; parse confidence; route to spam/quarantine/continue | L | P1 |
| 3.7 | Dedupe step | OpenAI embed text; pgvector similarity search; create or assign cluster; store embedding | XL | P1 |
| 3.8 | Categorization step | Claude Haiku; parse category; write to report | M | P1 |
| 3.9 | Urgency scoring step | Claude Haiku with scoring rubric; write score + reason | M | P1 |
| 3.10 | Entity extraction step | Claude Haiku; parse entities JSON; write to report | M | P1 |
| 3.11 | Web research step | Tavily search per business/place entity; Claude rates relevance; 7-day cache by entity name; write evidence rows | XL | P1 |
| 3.12 | Claude wrapper | `lib/claude.ts`: typed wrapper around `@anthropic-ai/sdk`; prompt caching headers; structured JSON output via tool use | M | P1 |
| 3.13 | OpenAI wrapper | `lib/openai.ts`: Whisper call + embedding call; error handling | S | P1 |
| 3.14 | Tavily wrapper | `lib/tavily.ts`: search call; response normalization | S | P1 |

---

### Epic 4 — Admin API

> Goal: Janek can see his queue, open report details, and manage quarantine. FE can build admin screens.

| # | Story | Tasks | Points | Priority |
|---|---|---|---|---|
| 4.1 | `GET /admin/reports` | Query `ready` reports; join cluster counts, entity counts, evidence counts; paginate; filter by category | L | P1 |
| 4.2 | `GET /admin/reports/:id` | Full detail join: report + media + evidence + cluster + similar reports + pipeline_runs | L | P1 |
| 4.3 | `PATCH /admin/reports/:id` | Update status to `actioned` or `archived`; write audit_log row | M | P1 |
| 4.4 | `GET /admin/quarantine` | List `quarantine` reports, sorted by created_at | M | P1 |
| 4.5 | `POST /admin/quarantine/:id/approve` | Reset report step to after spam; re-trigger pipeline | M | P2 |
| 4.6 | `POST /admin/quarantine/:id/reject` | Set status `spam`; write audit_log | S | P2 |
| 4.7 | Audit log writes | Write to `audit_log` on: report viewed, actioned, quarantine decision | M | P2 |

---

### Epic 5 — Production Readiness

> Goal: Deployed, monitored, stable. FE team can point their app at the production URL.

| # | Story | Tasks | Points | Priority |
|---|---|---|---|---|
| 5.1 | Railway deployment | Create Railway project; set env vars; connect GitHub; verify health endpoint | M | P1 |
| 5.2 | Sentry integration | Add Sentry SDK; capture unhandled errors in pipeline + API; set environment tag | M | P2 |
| 5.3 | Structured logging | `pino` logger; log level from env; never log PII or request bodies in prod | S | P2 |
| 5.4 | DB connection pooling | Use Supabase `pgbouncer` connection string in production (Transaction mode) | S | P2 |
| 5.5 | Load test | Simulate 200 concurrent report submissions; verify pipeline processes all within 5 min; no DB locks | M | P2 |
| 5.6 | FE handoff package | Finalize `shared.ts` types; write 1-page API guide with auth setup, base URL, Realtime subscription examples | M | P0 |

---

## 14. Open Questions

| # | Question | Owner | Deadline |
|---|---|---|---|
| Q1 | Does FE want sync Whisper preview (user sees transcript before submitting) or are they OK with async (Realtime notification after submit)? | Both teams | Before Epic 2 starts |
| Q2 | What is Janek's email address for magic link auth? | Client | Before Epic 4 |
| Q3 | pgvector dedupe threshold — start at 0.88 but needs tuning with real data. Do we have sample reports to test against? | BE | After Epic 3.7 |
| Q4 | Web research: Tavily or another search API? Do we have an API key? | BE | Before Epic 3.11 |
| Q5 | Quarantine: does Janek want push notification for quarantine items, or just see them in a tab? | FE + Client | Before Epic 4.4 |
| Q6 | Is the worker in this monorepo or a separate repo? | Both teams | Before Epic 1.3 |

---

## 15. Definition of Done

A story is done when:
- [ ] Code reviewed (or self-reviewed if solo)
- [ ] TypeScript strict: zero `any`, zero type errors
- [ ] Error cases handled and return correct status codes
- [ ] Relevant types in `shared.ts` updated if API shape changed
- [ ] Tested manually against local Supabase (`supabase start`)
- [ ] `worker/` builds with `bun run build` cleanly
- [ ] Relevant env var added to `.env.example`
