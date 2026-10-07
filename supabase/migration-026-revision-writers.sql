-- Migration 026: every listing writer advances revision.
-- Bulk inventory actions (slice 4) will rely on monotonic revisions for
-- conflict detection, so all mutation paths must participate: broker edits
-- (route code), reconfirm (route code), and the moderation/escalation/resolve
-- functions below. Submit paths start at revision 1.
begin;

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
    moderation_note = case when note <> '' then note else moderation_note end,
    revision = revision + 1
  where id=target;
  if not found then raise exception 'Listing not found'; end if;
  if actor_id is not null then
    insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
    values (actor_id, 'listing_' || operation, 'listing', target, detail, actor_email);
  end if;
end $$;

create or replace function public.auto_escalate_report()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_broker_id text;
  v_listing_verification text;
  v_broker_verified text;
  v_open_for_listing integer;
  v_open_recent_for_broker integer;
begin
  v_broker_id := NEW.broker_id;
  v_listing_verification := null;
  if NEW.listing_id is not null then
    select verification, broker_id
      into v_listing_verification, v_broker_id
      from public.listings
      where id = NEW.listing_id;
    if not found then
      return NEW;
    end if;
    select count(*)::integer
      into v_open_for_listing
      from public.reports
      where listing_id = NEW.listing_id
        and status not like 'Resolved%';
    if v_open_for_listing >= 2
      and v_listing_verification in ('verified', 'pending') then
      update public.listings
         set verification = 'flagged', revision = revision + 1
        where id = NEW.listing_id;
    end if;
  end if;
  select verified
    into v_broker_verified
    from public.brokers
    where id = v_broker_id;
  if not found then
    return NEW;
  end if;
  if v_broker_verified = 'verified' then
    select count(*)::integer
      into v_open_recent_for_broker
      from public.reports as r
      left join public.listings as l on l.id = r.listing_id
      where (l.broker_id = v_broker_id or r.broker_id = v_broker_id)
        and r.status not like 'Resolved%'
        and public.report_is_recent(r.date);
    if v_open_recent_for_broker >= 3 then
      update public.brokers
         set verified = 'suspended'
        where id = v_broker_id;
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.resolve_report(target text, upheld boolean, actor_id uuid default null, detail text default '', actor_email text default '', to_status text default null)
returns void
language plpgsql
set search_path = public
as $$
declare item reports%rowtype;
begin
  select * into item from reports where id=target for update;
  if not found then raise exception 'Report not found'; end if;
  if to_status is not null then
    if to_status <> 'Investigating' then raise exception 'Invalid status transition'; end if;
    if item.status <> 'Open' then raise exception 'Only an open report can be investigated'; end if;
    update reports set status='Investigating' where id=target;
    if actor_id is not null then
      insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
      values (actor_id, 'report_investigate', item.target_type, coalesce(item.listing_id, item.broker_id, target), detail, actor_email);
    end if;
    return;
  end if;
  if upheld is null then raise exception 'Choose uphold or dismiss'; end if;
  if item.status like 'Resolved%' then raise exception 'Report already resolved'; end if;
  if item.target_type = 'broker' then
    if item.broker_id is null then raise exception 'Broker report has no broker linked'; end if;
    if upheld then
      update brokers set verified='suspended' where id=item.broker_id;
    end if;
    update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
  else
    if upheld then update listings set verification='flagged', flags=array[item.reason], revision = revision + 1 where id=item.listing_id; end if;
    update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
  end if;
  if actor_id is not null then
    insert into admin_actions(actor_id, action, target_type, target_id, detail, actor_email)
    values (actor_id, case when upheld then 'report_uphold_' || item.target_type else 'report_dismiss_' || item.target_type end, item.target_type, coalesce(item.listing_id, item.broker_id, target), detail, actor_email);
  end if;
end $$;

commit;
