begin;
create or replace function sync_visit_status() returns trigger language plpgsql set search_path=public as $$
begin
 if new.seeker_visited and new.broker_visited and (new.seeker_visited is distinct from old.seeker_visited or new.broker_visited is distinct from old.broker_visited) then new.status='Visited'; end if;
 return new;
end $$;
drop trigger if exists lead_visit_status on leads;
create trigger lead_visit_status before update on leads for each row execute function sync_visit_status();
create or replace function sync_broker_reviews() returns trigger language plpgsql set search_path=public as $$
begin
 update brokers set rating=(select coalesce(round(avg(rating)::numeric,1),0) from reviews where broker_id=coalesce(new.broker_id,old.broker_id)), reviews_count=(select count(*) from reviews where broker_id=coalesce(new.broker_id,old.broker_id)) where id=coalesce(new.broker_id,old.broker_id);
 return coalesce(new,old);
end $$;
drop trigger if exists broker_review_totals on reviews;
create trigger broker_review_totals after insert or update or delete on reviews for each row execute function sync_broker_reviews();
update brokers b set rating=(select coalesce(round(avg(r.rating)::numeric,1),0) from reviews r where r.broker_id=b.id),reviews_count=(select count(*) from reviews r where r.broker_id=b.id);
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.reviews'::regclass and conname='reviews_rating_range') then alter table reviews add constraint reviews_rating_range check(rating between 1 and 5) not valid; end if; end $$;
alter table reviews validate constraint reviews_rating_range;
create table if not exists listing_addresses (listing_id text primary key references listings(id) on delete cascade, address text not null);
alter table listing_addresses enable row level security;
commit;
