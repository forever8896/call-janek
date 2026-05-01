-- ─── reports ──────────────────────────────────────────────────────────────────
alter table reports enable row level security;

-- Anonymous reporters: insert own reports
create policy "reporter_insert" on reports
  for insert
  with check (auth.uid() = reporter_id or reporter_id is null);

-- Reporters: view only their own
create policy "reporter_select_own" on reports
  for select
  using (auth.uid() = reporter_id);

-- Admin: view all non-spam reports
create policy "admin_select_all" on reports
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin_update" on reports
  for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── report_media ──────────────────────────────────────────────────────────────
alter table report_media enable row level security;

create policy "reporter_insert_media" on report_media
  for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and (r.reporter_id = auth.uid() or r.reporter_id is null)
    )
  );

create policy "admin_select_media" on report_media
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── pipeline_runs ─────────────────────────────────────────────────────────────
alter table pipeline_runs enable row level security;

create policy "admin_only_pipeline_runs" on pipeline_runs
  for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── evidence ─────────────────────────────────────────────────────────────────
alter table evidence enable row level security;

create policy "admin_only_evidence" on evidence
  for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── report_clusters ──────────────────────────────────────────────────────────
alter table report_clusters enable row level security;

create policy "admin_only_clusters" on report_clusters
  for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── audit_log ────────────────────────────────────────────────────────────────
alter table audit_log enable row level security;

create policy "admin_only_audit" on audit_log
  for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ─── categories: public read ───────────────────────────────────────────────────
alter table categories enable row level security;

create policy "public_read_categories" on categories
  for select using (true);
