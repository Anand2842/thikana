-- Migration 017: close admin-readiness gaps (authz durability, retention clock).
begin;
-- Retention + response clocks on leads (backfilled from the legacy date text).
alter table leads add column if not exists created_at timestamptz not null default now();
alter table leads add column if not exists first_response_at timestamptz;
update leads
   set created_at = to_date(date, 'DD Mon YYYY')::timestamptz
 where date ~ '^\d{1,2} [A-Za-z]{3} \d{4}$';

-- Keep attribution when an administrator account is removed: the email
-- snapshot in detail survives, the id reference clears instead of cascading.
alter table admin_actions add column if not exists actor_email text not null default '';
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'admin_actions_actor_id_fkey') then
    alter table admin_actions drop constraint admin_actions_actor_id_fkey;
  end if;
end $$;
alter table admin_actions add constraint admin_actions_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
alter table admin_actions alter column actor_id drop not null;

-- Atomic broker moderation + audit log (one transaction instead of route fan-out).
create or replace function public.moderate_broker(target text, operation text, actor_id uuid default null, detail text default '', actor_email text default '')
returns void
language plpgsql
set search_path = public
as $$
begin
  if operation not in ('approve','suspend','reject') then raise exception 'Invalid operation'; end if;
  update brokers set verified=case when operation='approve' then 'verified' else 'suspended' end,
  vdate=case when operation='approve' then to_char(now(),'DD Mon YYYY') else vdate end where id=target;
  if not found then raise exception 'Broker not found'; end if;
  if operation <> 'approve' then update listings set verification='flagged', flags=array['Broker suspended — contact unavailable'] where broker_id=target; end if;
  if actor_id is not null then
    insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
    values (actor_id, 'broker_' || operation, 'broker', target, detail);
  end if;
end $$;

-- Atomic report resolution incl. broker targets + audit log.
create or replace function public.resolve_report(target text, upheld boolean, actor_id uuid default null, detail text default '', actor_email text default '')
returns void
language plpgsql
set search_path = public
as $$
declare item reports%rowtype;
begin
  select * into item from reports where id=target for update;
  if not found then raise exception 'Report not found'; end if;
  if item.status like 'Resolved%' then raise exception 'Report already resolved'; end if;
  if item.target_type = 'broker' then
    if item.broker_id is null then raise exception 'Broker report has no broker linked'; end if;
    if upheld then
      update brokers set verified='suspended' where id=item.broker_id;
    end if;
    update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
  else
    if upheld then update listings set verification='flagged', flags=array[item.reason] where id=item.listing_id; end if;
    update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
  end if;
  if actor_id is not null then
    insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
    values (actor_id, case when upheld then 'report_uphold_' || item.target_type else 'report_dismiss_' || item.target_type end, item.target_type, coalesce(item.listing_id, item.broker_id, target), detail);
  end if;
end $$;

-- Atomic listing moderation + audit log.
create or replace function public.moderate_listing(target text, operation text, actor_id uuid default null, detail text default '', actor_email text default '', note text default '')
returns void
language plpgsql
set search_path = public
as $$
begin
  if operation not in ('approve','expire','flag') then raise exception 'Invalid operation'; end if;
  update listings set
    verification = case when operation='approve' then 'verified' when operation='expire' then 'stale' else 'flagged' end,
    hrs = case when operation='approve' then 0 else hrs end,
    last_confirmed_at = case when operation='approve' then now() else last_confirmed_at end,
    flags = case when operation='approve' then '{}' when operation='flag' then array['Under review by trust team'] else flags end,
    moderation_note = case when note <> '' then note else moderation_note end
  where id=target;
  if not found then raise exception 'Listing not found'; end if;
  if actor_id is not null then
    insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
    values (actor_id, 'listing_' || operation, 'listing', target, detail);
  end if;
end $$;

revoke all on function public.moderate_broker(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_broker(text,text,uuid,text,text) to service_role;
revoke all on function public.resolve_report(text,boolean,uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_report(text,boolean,uuid,text,text) to service_role;
revoke all on function public.moderate_listing(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.moderate_listing(text,text,uuid,text,text,text) to service_role;
commit;
