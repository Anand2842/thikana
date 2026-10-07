-- Slice 2: private inventory media.
-- inventory_assets tracks broker-owned uploads in the private
-- inventory-media bucket. No public access: every read goes through
-- /api/inventory-media/[id], which mirrors the listing visibility rule
-- (public iff linked listing verification <> 'pending'; screenshots and
-- draft-stage photos are owner/MFA-admin only).

insert into storage.buckets (id, name, public)
values ('inventory-media', 'inventory-media', false)
on conflict (id) do nothing;

create table if not exists inventory_assets (
  id text primary key,
  broker_id text not null references brokers(id) on delete cascade,
  draft_id text references listing_drafts(id) on delete set null,
  kind text not null check (kind in ('photo', 'screenshot')),
  storage_path text not null unique,
  mime text not null,
  bytes integer not null default 0,
  sha256 text,
  state text not null default 'reserved' check (state in ('reserved', 'ready', 'failed')),
  position integer not null default 0,
  reserved_until timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
alter table inventory_assets enable row level security;
-- No policies: service-role only, all access through authorize()d APIs.
create index if not exists inventory_assets_broker_idx on inventory_assets (broker_id, created_at desc);
create index if not exists inventory_assets_draft_idx on inventory_assets (draft_id, position);

commit;
