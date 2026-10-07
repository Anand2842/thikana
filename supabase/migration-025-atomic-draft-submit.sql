-- Migration 025: atomic draft submission.
-- Backstop: one listing per source draft, enforced by a partial unique index
-- (concurrent submits serialize on the draft row lock; the index makes
-- double-insertion impossible even if application guards race).
begin;
create unique index if not exists listings_source_draft_unique
  on listings (source_draft_id) where source_draft_id is not null;

-- Lock (draft row) → check (ownership, revision, archived, not submitted,
-- broker still verified) → create (listing + private address via the same
-- submit_listing path) → link (draft submitted + revision bump), all in one
-- transaction. Repeat callers get 'already submitted' and must read back the
-- linked listing; nothing is created twice and no orphan can escape.
create or replace function public.submit_draft_listing(
  p_draft_id text,
  p_broker_id text,
  p_expected_revision int,
  p_listing jsonb,
  p_address text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_draft listing_drafts%rowtype;
  v_saved jsonb;
begin
  select * into v_draft from listing_drafts
   where id = p_draft_id and broker_id = p_broker_id
   for update;
  if not found then raise exception 'Draft not found'; end if;
  if v_draft.archived then raise exception 'Archived drafts cannot be submitted'; end if;
  if v_draft.submitted_listing_id is not null then raise exception 'Already submitted'; end if;
  if v_draft.revision <> p_expected_revision then raise exception 'Stale revision'; end if;
  if not exists (
    select 1 from brokers where id = p_broker_id and verified = 'verified'
  ) then raise exception 'Submission unlocks after approval'; end if;
  select submit_listing(p_listing, p_address) into v_saved;
  update listing_drafts
     set submitted_listing_id = v_saved->>'id',
         revision = p_expected_revision + 1,
         updated_at = now()
   where id = p_draft_id;
  return v_saved;
end $$;

revoke all on function public.submit_draft_listing(text,text,int,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_draft_listing(text,text,int,jsonb,text) to service_role;
commit;
