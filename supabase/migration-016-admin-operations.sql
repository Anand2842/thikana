-- Migration 016: admin operations completeness.
begin;
-- Investigator notes on reports (evidence requests, progress, resolution reasons).
create table if not exists report_notes (
  id text primary key,
  report_id text not null references reports(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table report_notes enable row level security;
-- No public policies: service-role only, participant-checked in app code.

-- Audit trail for every admin moderation decision.
create table if not exists admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table admin_actions enable row level security;
-- No public policies: service-role only, admin console only.
commit;
