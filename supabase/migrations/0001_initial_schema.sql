-- Enable pgvector for embeddings-based duplicate detection
create extension if not exists vector;
create extension if not exists pg_cron;

-- ─── report_clusters (referenced by reports.cluster_id) ───────────────────────
create table report_clusters (
  id                    uuid primary key default gen_random_uuid(),
  canonical_report_id   uuid not null,
  report_count          int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── reports ──────────────────────────────────────────────────────────────────
create table reports (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  reporter_id           uuid references auth.users(id) on delete set null,
  status                text not null default 'queued'
                        check (status in (
                          'queued','transcribing','processing',
                          'ready','spam','quarantine','archived','actioned'
                        )),
  text_description      text,
  transcript            text,
  location              text,
  business_name         text,
  category              text check (category in (
                          'taxi_scam','fake_exchange','online_fraud',
                          'restaurant_scam','other'
                        )),
  urgency_score         smallint check (urgency_score between 1 and 10),
  urgency_reason        text,
  cluster_id            uuid references report_clusters(id) on delete set null,
  entities              jsonb,
  pipeline_started_at   timestamptz,
  pipeline_completed_at timestamptz
);

-- Add FK back from report_clusters to reports (after reports table exists)
alter table report_clusters
  add constraint report_clusters_canonical_report_id_fkey
  foreign key (canonical_report_id) references reports(id) on delete restrict;

create index reports_status_idx     on reports(status);
create index reports_urgency_idx    on reports(urgency_score desc) where status = 'ready';
create index reports_cluster_idx    on reports(cluster_id) where cluster_id is not null;
create index reports_created_idx    on reports(created_at desc);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

-- ─── report_media ──────────────────────────────────────────────────────────────
create table report_media (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  kind         text not null check (kind in ('image','video','audio')),
  mime_type    text not null,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index report_media_report_idx on report_media(report_id);

-- ─── pipeline_runs ─────────────────────────────────────────────────────────────
create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  step         text not null check (step in (
                 'whisper','spam','dedupe','category',
                 'urgency','entities','web_research'
               )),
  status       text not null default 'pending'
               check (status in ('pending','running','done','failed','skipped')),
  result       jsonb,
  attempts     smallint not null default 0,
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,
  unique(report_id, step)
);

create index pipeline_runs_report_idx  on pipeline_runs(report_id);
create index pipeline_runs_failed_idx  on pipeline_runs(status) where status = 'failed';

-- ─── report_embeddings ────────────────────────────────────────────────────────
create table report_embeddings (
  report_id   uuid primary key references reports(id) on delete cascade,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);

create index report_embeddings_vec_idx
  on report_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ─── evidence ─────────────────────────────────────────────────────────────────
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

-- ─── categories (seed) ────────────────────────────────────────────────────────
create table categories (
  id       text primary key,
  label_cs text not null,
  label_en text not null
);

-- ─── audit_log ────────────────────────────────────────────────────────────────
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  target_id  uuid,
  meta       jsonb
);

-- ─── pgvector similarity search function ──────────────────────────────────────
create or replace function match_reports(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int
)
returns table (report_id uuid, similarity float)
language sql stable
as $$
  select
    re.report_id,
    1 - (re.embedding <=> query_embedding) as similarity
  from report_embeddings re
  join reports r on r.id = re.report_id
  where r.status not in ('spam', 'quarantine')
    and 1 - (re.embedding <=> query_embedding) > match_threshold
  order by re.embedding <=> query_embedding
  limit match_count;
$$;

-- ─── Recovery cron: unstick processing reports every 15 min ───────────────────
select cron.schedule(
  'pipeline-recovery',
  '*/15 * * * *',
  $$
    update pipeline_runs
    set status = 'pending', error = null
    where status = 'failed'
      and report_id in (
        select id from reports
        where status = 'processing'
          and pipeline_started_at < now() - interval '20 minutes'
      );
  $$
);
