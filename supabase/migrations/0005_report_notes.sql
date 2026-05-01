-- Free-form newsroom notes attached to a report.
-- Admin-only; reporters never see these.

create table if not exists report_notes (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  body        text not null check (length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index if not exists report_notes_report_idx
  on report_notes(report_id, created_at desc);

alter table report_notes enable row level security;

-- Worker uses service_role and bypasses RLS. This policy is for the
-- (rare) case the admin client reads/writes notes directly.
create policy "admin_only_select" on report_notes
  for select using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' = 'admin'
    )
  );

create policy "admin_only_insert" on report_notes
  for insert with check (
    exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' = 'admin'
    )
  );
