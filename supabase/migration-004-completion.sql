begin;
alter table listings add column if not exists last_confirmed_at timestamptz;
update listings set last_confirmed_at = now() - make_interval(hours => hrs) where last_confirmed_at is null;
alter table listings alter column last_confirmed_at set default now();
alter table listings alter column last_confirmed_at set not null;
alter table listings add column if not exists created_at timestamptz not null default now();
alter table leads add column if not exists visit_at timestamptz;
alter table leads add column if not exists seeker_visited boolean not null default false;
alter table leads add column if not exists broker_visited boolean not null default false;
alter table reviews add column if not exists lead_id text references leads(id);
alter table reviews add column if not exists owner_id uuid references auth.users(id);
create unique index if not exists reviews_lead_unique on reviews(lead_id) where lead_id is not null;
alter table reports add column if not exists owner_id uuid references auth.users(id);
create table if not exists broker_applications (
 broker_id text primary key references brokers(id), owner_id uuid not null unique references auth.users(id),
 phone text not null, identity_path text not null, business_path text not null, created_at timestamptz not null default now()
);
create table if not exists saved_listings (
 owner_id uuid not null references auth.users(id) on delete cascade,
 listing_id text not null references listings(id) on delete cascade,
 primary key(owner_id, listing_id)
);
alter table broker_applications enable row level security;
alter table saved_listings enable row level security;
-- Public catalog never exposes pending inventory. Staff and its assigned broker may inspect it.
drop policy if exists "public read listings" on listings;
create policy "public read listings" on listings for select to anon, authenticated using (
 verification <> 'pending' or auth.jwt()->'app_metadata'->>'role' = 'admin'
 or broker_id = auth.jwt()->'app_metadata'->>'broker_id'
);
-- Reports, applications, enquiries and saves have no public policies. Server checks ownership.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
 ('listing-photos','listing-photos',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('broker-proofs','broker-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- All mutations go through authenticated server routes using service_role.
create or replace function moderate_broker(target text, operation text) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if operation not in ('approve','suspend','reject') then raise exception 'Invalid operation'; end if;
 update brokers set verified=case when operation='approve' then 'verified' else 'suspended' end,
 vdate=case when operation='approve' then to_char(now(),'DD Mon YYYY') else vdate end where id=target;
 if not found then raise exception 'Broker not found'; end if;
 if operation <> 'approve' then update listings set verification='flagged', flags=array['Broker suspended — contact unavailable'] where broker_id=target; end if;
end $$;
create or replace function resolve_report(target text, upheld boolean) returns void
language plpgsql security invoker set search_path=public as $$
declare item reports%rowtype;
begin
 select * into item from reports where id=target for update;
 if not found then raise exception 'Report not found'; end if;
 if item.status <> 'Open' then raise exception 'Report already resolved'; end if;
 if upheld then update listings set verification='flagged', flags=array[item.reason] where id=item.listing_id; end if;
 update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
end $$;
revoke all on function moderate_broker(text,text) from public,anon,authenticated;
revoke all on function resolve_report(text,boolean) from public,anon,authenticated;
grant execute on function moderate_broker(text,text),resolve_report(text,boolean) to service_role;
commit;
