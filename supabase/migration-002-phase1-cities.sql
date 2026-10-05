-- Migration 002: Phase 1 = Delhi + Gurugram + Noida + Greater Noida + Ghaziabad
-- Apply with: psql "$DATABASE_URL" -f supabase/migration-002-phase1-cities.sql
-- Then: npm run seed

alter table "brokers" add column if not exists "cities" text[] not null default '{Delhi}';
alter table "listings" add column if not exists "city" text not null default 'Delhi';

create table if not exists "city_requests" (
  "id" text primary key,
  "city" text not null,
  "name" text not null,
  "phone" text not null,
  "user_type" text not null default 'seeker',
  "note" text not null default '',
  "status" text not null default 'New',
  "date" text not null default ''
);

alter table "city_requests" enable row level security;
-- No anon/authenticated policies → service_role only (PII).
