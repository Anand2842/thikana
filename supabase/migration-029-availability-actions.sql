-- Slice 4: guarded availability operations.
-- One transaction per item: lock the listing, verify ownership, expected
-- revision, live broker approval and review eligibility, then apply. A
-- concurrent suspension or moderation decision inside the same gulp becomes
-- a visible rejection, never a silent overwrite. Marking Available never
-- refreshes the confirmation clock; only an explicit reconfirm does.

alter table inventory_requests drop constraint if exists inventory_requests_kind_check;
alter table inventory_requests add check (kind in ('batch-submit', 'bulk-action'));

create or replace function public.apply_availability_action(p_listing_id text, p_broker_id text, p_expected_revision integer, p_action text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_broker brokers%rowtype;
  v_saved listings%rowtype;
begin
  if p_action not in ('taken', 'onhold', 'available', 'reconfirm') then
    raise exception 'Invalid action';
  end if;
  select * into v_listing from listings where id = p_listing_id for update;
  -- Same message for missing and foreign rows: no cross-broker oracle.
  if not found or v_listing.broker_id <> p_broker_id then
    raise exception 'Listing not found';
  end if;
  if v_listing.revision <> p_expected_revision then
    raise exception 'Stale revision';
  end if;
  select * into v_broker from brokers where id = p_broker_id;
  if not found or v_broker.verified <> 'verified' then
    raise exception 'Broker approval required';
  end if;
  -- Pending/flagged records cannot bypass review through availability.
  if v_listing.verification in ('pending', 'flagged') then
    raise exception 'Under review — availability actions unlock after approval';
  end if;
  if p_action = 'reconfirm' then
    if v_listing.verification not in ('verified', 'stale') then
      raise exception 'Only approved homes can be reconfirmed';
    end if;
    update listings
       set hrs = 0,
           last_confirmed_at = now(),
           verification = 'verified',
           revision = revision + 1
     where id = p_listing_id
    returning * into v_saved;
  else
    update listings
       set availability_status = case p_action
           when 'taken' then 'Taken'
           when 'onhold' then 'OnHold'
           else 'Available'
         end,
         revision = revision + 1
     where id = p_listing_id
    returning * into v_saved;
  end if;
  return jsonb_build_object(
    'id', v_saved.id,
    'revision', v_saved.revision,
    'availability_status', v_saved.availability_status,
    'verification', v_saved.verification
  );
end $$;

revoke all on function public.apply_availability_action(text,text,int,text) from public,anon,authenticated;
grant execute on function public.apply_availability_action(text,text,int,text) to service_role;

commit;
