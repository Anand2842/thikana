create or replace function public.submit_listing(payload jsonb, address text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare saved listings%rowtype;
begin
 insert into listings select * from jsonb_populate_record(null::listings,
  jsonb_build_object('sector','','type','Apartment','deposit',0,'furnishing','','area',0,'floor','','amenities','[]'::jsonb,'avail','','brok','','brok_days',0,'visit_fee',0,'visit_fee_refundable',false,'other_fee',0,'other_fee_note','','photos','[]'::jsonb,'photo_hashes','[]'::jsonb,'hrs',0,'verification','pending','description','','views',0,'enq',0,'flags','[]'::jsonb,'city','Delhi','owner_relationship','agent','availability_status','Available','moderation_note','','created_at',now(),'last_confirmed_at',now()) || payload)
 returning * into saved;
 insert into listing_addresses(listing_id,address) values(saved.id,address);
 return to_jsonb(saved);
end $$;
revoke all on function public.submit_listing(jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_listing(jsonb,text) to service_role;
