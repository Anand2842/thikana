-- Migration 018: retention clock for city requests.
begin;
alter table city_requests add column if not exists created_at timestamptz not null default now();
commit;
