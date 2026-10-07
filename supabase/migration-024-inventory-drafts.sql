-- Migration 022: broker fast-inventory workspace (slice 1).
-- Private drafts + reusable building context. No public policies: all access
-- goes through authenticated broker-scoped server routes using service_role.
begin;
create table if not exists broker_buildings (
  id text primary key,
  broker_id text not null references brokers(id) on delete cascade,
  label text not null default '',
  city text not null default '',
  locality text not null default '',
  street text not null default '',
  sector text not null default '',
  amenities text[] not null default '{}',
  defaults jsonb not null default '{}',
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists broker_buildings_broker_idx on broker_buildings (broker_id);
create index if not exists broker_buildings_updated_idx on broker_buildings (broker_id, updated_at desc);

create table if not exists listing_drafts (
  id text primary key,
  broker_id text not null references brokers(id) on delete cascade,
  building_id text references broker_buildings(id) on delete set null,
  fields jsonb not null default '{}',
  confirmations jsonb not null default '{}',
  revision int not null default 1,
  archived boolean not null default false,
  submitted_listing_id text references listings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listing_drafts_broker_idx on listing_drafts (broker_id, updated_at desc);

alter table broker_buildings enable row level security;
alter table listing_drafts enable row level security;

-- Submission identity + edit-conflict protection on listings. Defaults keep
-- existing rows valid; new writers set/advance revision (see shared submit lib).
alter table listings add column if not exists source_draft_id text references listing_drafts(id) on delete set null;
alter table listings add column if not exists revision int not null default 1;
commit;
