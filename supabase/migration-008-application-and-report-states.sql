begin;
create or replace function public.submit_broker(broker jsonb, application jsonb) returns void
language plpgsql security invoker set search_path=public as $$
begin
 insert into brokers(id,name,agency,cities,areas,policy) values(broker->>'id',broker->>'name',broker->>'agency',array(select jsonb_array_elements_text(broker->'cities')),array(select jsonb_array_elements_text(broker->'areas')),broker->>'policy')
 on conflict(id) do update set name=excluded.name,agency=excluded.agency,cities=excluded.cities,areas=excluded.areas,policy=excluded.policy,verified='pending',kyc='Documents submitted for human review';
 insert into broker_applications(broker_id,owner_id,phone,identity_path,business_path) values(broker->>'id',(application->>'owner_id')::uuid,application->>'phone',application->>'identity_path',application->>'business_path')
 on conflict(owner_id) do update set phone=excluded.phone,identity_path=excluded.identity_path,business_path=excluded.business_path,created_at=now();
end $$;
create or replace function resolve_report(target text, upheld boolean) returns void
language plpgsql security invoker set search_path=public as $$
declare item reports%rowtype;
begin
 select * into item from reports where id=target for update;
 if not found then raise exception 'Report not found'; end if;
 if item.status like 'Resolved%' then raise exception 'Report already resolved'; end if;
 if upheld then update listings set verification='flagged', flags=array[item.reason] where id=item.listing_id; end if;
 update reports set status=case when upheld then 'Resolved · upheld' else 'Resolved · dismissed' end where id=target;
end $$;
commit;
