-- Migration 014: broker-side completeness (inventory/profile/inbox/visits/read receipts/moderation feedback).
begin;
-- 1. Inventory: availability distinct from moderation state.
alter table listings add column if not exists availability_status text not null default 'Available';
-- 2. Broker profile: address + self-serve fields (photo/areas/policy/exp live in brokers already).
alter table brokers add column if not exists business_address text not null default '';
-- 3. Close outcome: 'booked' vs 'not_interested', set when a lead closes.
alter table leads add column if not exists outcome text;
-- 4. Visit agreement: proposal state instead of unilateral scheduling.
alter table leads add column if not exists visit_proposed_by uuid references auth.users(id);
alter table leads add column if not exists visit_accepted boolean not null default false;
-- 5. Read receipts for message threads.
create table if not exists lead_reads (
  lead_id text not null references leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (lead_id, user_id)
);
alter table lead_reads enable row level security;
-- No public policies: service-role only, participant-checked in app code.
-- 6. Moderation feedback visible to the affected broker.
alter table brokers add column if not exists moderation_note text not null default '';
alter table listings add column if not exists moderation_note text not null default '';
-- 7. Ownership disclosure: broker owns the unit vs markets it for the owner.
alter table listings add column if not exists owner_relationship text not null default 'agent';
commit;
