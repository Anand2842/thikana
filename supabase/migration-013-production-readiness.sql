-- Migration 013: production-readiness slice for tenants.
-- Fee transparency, enquiry messaging, broker-target reports, photo hashes.
begin;
alter table listings add column if not exists visit_fee_refundable boolean not null default false;
alter table listings add column if not exists other_fee_note text not null default '';
alter table listings add column if not exists photo_hashes text[] not null default '{}';

create table if not exists lead_messages (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table lead_messages enable row level security;
-- No public policies: all access goes through authenticated server routes
-- using service_role with participant checks (mirrors leads/reports).

alter table reports add column if not exists target_type text not null default 'listing';
alter table reports add column if not exists broker_id text references brokers(id) on delete set null;
alter table reports alter column listing_id drop not null;

alter table leads add column if not exists visit_reminded_at timestamptz;
commit;
