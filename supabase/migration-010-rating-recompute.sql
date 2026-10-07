-- migration-010-rating-recompute.sql
-- Broker ratings recompute from verified-visit reviews (truthful by design).
--
-- NOTE: seed demo ratings will be overwritten by computed values wherever
-- reviews exist (and zeroed where no reviews exist). This is intentional:
-- brokers.rating / brokers.reviews_count become derived, not hand-set.
-- `npm run seed` inserts brokers first and reviews AFTER brokers, so on a
-- fresh seed the trigger fires on each review insert and trigger state
-- always wins over the static seed ratings.
--
-- SUPERSEDES migration-006's broker_review_totals trigger (same formula, but
-- 006 recomputes only coalesce(new,old).broker_id and misses broker
-- reassignment on UPDATE). Retired below. reviews_rating_range CHECK from
-- 006 still bounds inputs to 1–5, so AVG stays in range.
--
-- No recursion risk: this trigger lives on reviews and only writes brokers;
-- no trigger exists on brokers, so the UPDATEs below cannot re-fire it.

-- Retire the predecessor trigger (identical math, weaker UPDATE handling).
drop trigger if exists broker_review_totals on public.reviews;
drop function if exists public.sync_broker_reviews();

-- 1. Trigger function: recompute rating + reviews_count for affected broker(s).
create or replace function public.recompute_broker_rating()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update public.brokers as b
    set rating = coalesce(
          (select round(avg(r.rating)::numeric, 1)
             from public.reviews as r
            where r.broker_id = NEW.broker_id),
          0),
        reviews_count = (
          select count(*)
            from public.reviews as r
           where r.broker_id = NEW.broker_id)
    where b.id = NEW.broker_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.brokers as b
    set rating = coalesce(
          (select round(avg(r.rating)::numeric, 1)
             from public.reviews as r
            where r.broker_id = OLD.broker_id),
          0),
        reviews_count = (
          select count(*)
            from public.reviews as r
           where r.broker_id = OLD.broker_id)
    where b.id = OLD.broker_id;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    -- Always recompute the NEW broker row (covers rating/text edits in place).
    update public.brokers as b
    set rating = coalesce(
          (select round(avg(r.rating)::numeric, 1)
             from public.reviews as r
            where r.broker_id = NEW.broker_id),
          0),
        reviews_count = (
          select count(*)
            from public.reviews as r
           where r.broker_id = NEW.broker_id)
    where b.id = NEW.broker_id;
    -- If the review moved brokers, recompute the OLD broker row too.
    if OLD.broker_id is distinct from NEW.broker_id then
      update public.brokers as b
      set rating = coalesce(
            (select round(avg(r.rating)::numeric, 1)
               from public.reviews as r
              where r.broker_id = OLD.broker_id),
            0),
          reviews_count = (
            select count(*)
              from public.reviews as r
             where r.broker_id = OLD.broker_id)
      where b.id = OLD.broker_id;
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_recompute_broker_rating on public.reviews;

create trigger reviews_recompute_broker_rating
after insert or update or delete on public.reviews
for each row
execute function public.recompute_broker_rating();

-- 2. One-time backfill: apply the same math to every broker row.
-- Brokers with zero reviews get rating 0 / reviews_count 0.
update public.brokers as b
set rating = coalesce(
      (select round(avg(r.rating)::numeric, 1)
         from public.reviews as r
        where r.broker_id = b.id),
      0),
    reviews_count = (
      select count(*)
        from public.reviews as r
       where r.broker_id = b.id);
