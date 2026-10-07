-- Migration 012: listing-intake integrity — owner authorization
-- Apply with: psql "$DATABASE_URL" -f supabase/migration-012-intake-integrity.sql
-- Adds owner attribution + authorization flag to listings. Defaults keep seed.ts working unchanged.

alter table listings add column if not exists owner_name text not null default '';
alter table listings add column if not exists owner_authorized boolean not null default false;
