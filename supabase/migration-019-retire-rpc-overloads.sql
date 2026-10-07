-- Migration 019: retire pre-atomic RPC overloads superseded by 017.
-- PostgREST cannot disambiguate duplicate signatures; the old 2-param
-- variants must go so service-role calls resolve to the atomic versions.
begin;
drop function if exists public.moderate_broker(text, text);
drop function if exists public.resolve_report(text, boolean);
commit;
