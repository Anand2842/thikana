-- Migration 003: own private records by authenticated user.
-- Leads and city requests carry phone numbers — reads must be scoped,
-- never service-wide. Existing seed rows keep owner_id NULL (demo data).
-- Apply with: psql "$DATABASE_URL" -f supabase/migration-003-lead-ownership.sql

alter table "leads" add column if not exists "owner_id" uuid;
alter table "city_requests" add column if not exists "owner_id" uuid;

create index if not exists "leads_owner_idx" on "leads" ("owner_id");
create index if not exists "leads_broker_idx" on "leads" ("broker_id");
create index if not exists "city_requests_owner_idx" on "city_requests" ("owner_id");

-- No anon/authenticated policies on either table: all access via
-- service_role with app-level scoping (see src/app/api/*/route.ts).
-- Public catalog tables (brokers, listings, reviews) keep their SELECT policies.
