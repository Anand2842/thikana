-- Migration 021: drop the superseded 5-param resolve_report overload.
-- Migration 020 added to_status; both overloads coexisting makes PostgREST
-- unable to choose (PGRST203), breaking every report decision.
begin;
drop function if exists public.resolve_report(text, boolean, uuid, text, text);
commit;
