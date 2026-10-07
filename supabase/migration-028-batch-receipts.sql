-- Slice 3: durable batch-submission receipts + request linkage.
-- inventory_requests records one row per client request ID: a repeated
-- request ID with different content is rejected (409); with identical
-- content the recorded per-item results replay. No public/anon access.

create table if not exists inventory_requests (
  id text primary key,
  broker_id text not null references brokers(id) on delete cascade,
  client_request_id text not null,
  kind text not null default 'batch-submit' check (kind in ('batch-submit')),
  input_hash text not null,
  items jsonb not null default '[]',
  results jsonb not null default '[]',
  state text not null default 'open' check (state in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (broker_id, client_request_id)
);
alter table inventory_requests enable row level security;
-- No policies: service-role only, all access through authorize()d APIs.
create index if not exists inventory_requests_broker_idx on inventory_requests (broker_id, created_at desc);

alter table listings add column if not exists source_request_id text;

-- Batch linkage: the atomic unit is unchanged (lock draft, check, insert,
-- link); the originating request ID is stamped on the listing for grouped
-- admin review. Old 5-arg calls keep working via the default.
drop function if exists public.submit_draft_listing(text,text,int,jsonb,text);
drop function if exists public.submit_draft_listing(text,text,int,jsonb,text,text);
create function public.submit_draft_listing(p_draft_id text, p_broker_id text, p_expected_revision integer, p_listing jsonb, p_address text, p_source_request_id text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_draft listing_drafts%rowtype;
  v_saved jsonb;
begin
  select * into v_draft from listing_drafts
   where id = p_draft_id and broker_id = p_broker_id
   for update;
  if not found then raise exception 'Draft not found'; end if;
  if v_draft.archived then raise exception 'Archived drafts cannot be submitted'; end if;
  if v_draft.submitted_listing_id is not null then raise exception 'Already submitted'; end if;
  if v_draft.revision <> p_expected_revision then raise exception 'Stale revision'; end if;
  if not exists (
    select 1 from brokers where id = p_broker_id and verified = 'verified'
  ) then raise exception 'Submission unlocks after approval'; end if;
  select submit_listing(p_listing, p_address) into v_saved;
  update listing_drafts
     set submitted_listing_id = v_saved->>'id',
         revision = p_expected_revision + 1,
         updated_at = now()
   where id = p_draft_id;
  if p_source_request_id is not null then
    update listings set source_request_id = p_source_request_id
     where id = v_saved->>'id';
  end if;
  return v_saved;
end $$;

revoke all on function public.submit_draft_listing(text,text,int,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_draft_listing(text,text,int,jsonb,text,text) to service_role;

commit;
