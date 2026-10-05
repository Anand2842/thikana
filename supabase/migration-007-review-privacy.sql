-- Public reviews do not expose account or private enquiry identifiers.
revoke select on reviews from public,anon,authenticated;
grant select(id,broker_id,user_name,rating,text,date,tag) on reviews to anon,authenticated;
