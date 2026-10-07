begin;
-- Existing applications remain unaccepted: never invent historic consent.
alter table broker_applications add column if not exists agreement_version text;
alter table broker_applications add column if not exists agreement_accepted_at timestamptz;
alter table broker_applications add column if not exists privacy_version text;
alter table broker_applications add column if not exists verification_consented_at timestamptz;
create or replace function public.submit_broker(broker jsonb, application jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if coalesce(application->>'agreement_version','') = '' or coalesce(application->>'privacy_version','') = '' then
    raise exception 'Policy acceptance required';
  end if;
  insert into brokers(id,name,agency,cities,areas,policy,photo,business_address,exp,cats)
  values(broker->>'id',broker->>'name',broker->>'agency',array(select jsonb_array_elements_text(broker->'cities')),
    array(select jsonb_array_elements_text(broker->'areas')),broker->>'policy',coalesce(broker->>'photo',''),
    coalesce(broker->>'business_address',''),coalesce((broker->>'exp')::int,0),
    coalesce(array(select jsonb_array_elements_text(broker->'cats')),'{}'))
  on conflict(id) do update set name=excluded.name,agency=excluded.agency,cities=excluded.cities,areas=excluded.areas,
    policy=excluded.policy,photo=excluded.photo,business_address=excluded.business_address,exp=excluded.exp,
    cats=excluded.cats,verified='pending',kyc='Documents submitted for human review';
  insert into broker_applications(broker_id,owner_id,phone,identity_path,business_path,agreement_version,agreement_accepted_at,privacy_version,verification_consented_at)
  values(broker->>'id',(application->>'owner_id')::uuid,application->>'phone',application->>'identity_path',application->>'business_path',
    application->>'agreement_version',now(),application->>'privacy_version',now())
  on conflict(owner_id) do update set phone=excluded.phone,identity_path=excluded.identity_path,business_path=excluded.business_path,
    created_at=now(),agreement_version=excluded.agreement_version,agreement_accepted_at=now(),
    privacy_version=excluded.privacy_version,verification_consented_at=now();
end $$;
revoke all on function public.submit_broker(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_broker(jsonb,jsonb) to service_role;

create table if not exists privacy_requests (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  contact_email text not null check(length(contact_email) between 3 and 254),
  kind text not null check(kind in ('Access','Correction','Deletion','Withdraw consent','Privacy complaint','Moderation appeal')),
  details text not null check(length(details) between 10 and 2000),
  status text not null default 'Open' check(status in ('Open','Reviewing','Closed')),
  response text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table privacy_requests enable row level security;
-- Service-role only. Requester reads are scoped by authenticated owner_id.
create index if not exists privacy_requests_owner_created_idx on privacy_requests(owner_id,created_at desc);
create index if not exists privacy_requests_status_created_idx on privacy_requests(status,created_at desc);

create or replace function public.review_privacy_request(target text, next_status text, expected_status text, reply text, actor uuid, actor_email text)
returns void language plpgsql set search_path = public as $$
declare item privacy_requests%rowtype;
begin
  select * into item from privacy_requests where id=target for update;
  if not found then raise exception 'Request not found'; end if;
  if item.status <> expected_status or item.status='Closed' then raise exception 'Request changed'; end if;
  if not ((item.status='Open' and next_status='Reviewing') or (item.status='Reviewing' and next_status='Closed')) then raise exception 'Invalid transition'; end if;
  if length(trim(reply)) not between 10 and 2000 then raise exception 'Response required'; end if;
  update privacy_requests set status=next_status,response=trim(reply),updated_at=now() where id=target;
  insert into admin_actions(actor_id,actor_email,action,target_type,target_id,detail)
  values(actor,actor_email,'privacy_' || lower(next_status),'privacy_request',target,'Request moved to ' || next_status);
end $$;
revoke all on function public.review_privacy_request(text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_privacy_request(text,text,text,text,uuid,text) to service_role;
commit;
