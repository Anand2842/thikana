-- Migration 015: persist onboarding profile fields.
-- submit_broker previously dropped photo, business_address, exp and cats,
-- so new applications lost them even though the form collected them.
begin;
create or replace function public.submit_broker(broker jsonb, application jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into brokers(id,name,agency,cities,areas,policy,photo,business_address,exp,cats)
  values(
    broker->>'id',broker->>'name',broker->>'agency',
    array(select jsonb_array_elements_text(broker->'cities')),
    array(select jsonb_array_elements_text(broker->'areas')),
    broker->>'policy',
    coalesce(nullif(broker->>'photo',''), ''),
    coalesce(nullif(broker->>'business_address',''), ''),
    coalesce((broker->>'exp')::int, 0),
    coalesce(array(select jsonb_array_elements_text(broker->'cats')), '{}')
  )
  on conflict(id) do update set name=excluded.name,agency=excluded.agency,cities=excluded.cities,areas=excluded.areas,policy=excluded.policy,photo=excluded.photo,business_address=excluded.business_address,exp=excluded.exp,cats=excluded.cats,verified='pending',kyc='Documents submitted for human review';
  insert into broker_applications(broker_id,owner_id,phone,identity_path,business_path) values(broker->>'id',(application->>'owner_id')::uuid,application->>'phone',application->>'identity_path',application->>'business_path')
  on conflict(owner_id) do update set phone=excluded.phone,identity_path=excluded.identity_path,business_path=excluded.business_path,created_at=now();
end $$;
commit;
