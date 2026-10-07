-- migration-011-report-escalation.sql
-- Automatic fraud escalation on new reports (trust safety net).
--
-- Thresholds:
--   1. Listing: >= 2 OPEN reports on the SAME listing (status NOT LIKE
--      'Resolved%') while the listing is 'verified' or 'pending'
--      → listings.verification := 'flagged'. Any non-resolved status counts
--      as open by design — including 'Nudged broker': only an explicit
--      'Resolved …' dismissal clears the count.
--   2. Broker: >= 3 OPEN reports in the last 30 days across ALL listings of
--      the reported listing's broker while the broker is 'verified'
--      → brokers.verified := 'suspended'.
--
-- reports.date is TEXT like '5 Oct 2026'. The 30-day window parses it with
-- to_date() guarded by a format regex (^\d{1,2} [A-Za-z]{3} \d{4}$); rows
-- with unparseable/empty dates count as recent (fail-safe toward safety).
--
-- System intake reports (e.g. reporter 'System · hash-match') count toward
-- these thresholds on purpose: a hash-match + a user complaint = flag.
--
-- Manual admin resolve (resolve_report RPC) still works on top: it keeps its
-- own guards ('Resolved%' prefix) and can uphold/dismiss any open report
-- regardless of whether this trigger already flagged/suspended anything.
--
-- No recursion risk: this trigger lives on reports AFTER INSERT and only
-- writes listings/brokers; no trigger exists on listings/brokers that
-- writes reports, so the UPDATEs below cannot re-fire it.

-- Helper: is a reports.date TEXT value within the last 30 days?
-- Returns TRUE for NULL/unparseable values (fail-safe toward safety).
create or replace function public.report_is_recent(p_date text)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  if p_date is null or p_date !~ '^\d{1,2} [A-Za-z]{3} \d{4}$' then
    return true;
  end if;
  begin
    return to_date(p_date, 'DD Mon YYYY') >= (current_date - 30);
  exception
    when others then
      return true;
  end;
end;
$$;

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
  -- Broker-target reports carry broker_id directly; listing reports resolve
  -- the broker through the listing. Either way the broker rule below applies.
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

    -- Rule 1: flag the listing once it has >= 2 open reports.
    -- AFTER INSERT, NEW is already visible, so the count includes it.
    select count(*)::integer
      into v_open_for_listing
      from public.reports
      where listing_id = NEW.listing_id
        and status not like 'Resolved%';

    if v_open_for_listing >= 2
      and v_listing_verification in ('verified', 'pending') then
      update public.listings
         set verification = 'flagged'
        where id = NEW.listing_id;
    end if;
  end if;

  -- Rule 2: suspend the broker once >= 3 open recent reports exist
  -- across all of their listings (only escalates a 'verified' broker).
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
end;
$$;

drop trigger if exists reports_auto_escalation on public.reports;

create trigger reports_auto_escalation
after insert on public.reports
for each row
execute function public.auto_escalate_report();
