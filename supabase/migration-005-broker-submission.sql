create or replace function public.submit_broker(broker jsonb, application jsonb) returns void
language plpgsql security invoker set search_path=public as $$
begin
 insert into brokers(id,name,agency,cities,areas,policy) values(broker->>'id',broker->>'name',broker->>'agency',array(select jsonb_array_elements_text(broker->'cities')),array(select jsonb_array_elements_text(broker->'areas')),broker->>'policy');
 insert into broker_applications(broker_id,owner_id,phone,identity_path,business_path) values(broker->>'id',(application->>'owner_id')::uuid,application->>'phone',application->>'identity_path',application->>'business_path');
end $$;
revoke all on function public.submit_broker(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_broker(jsonb,jsonb) to service_role;
