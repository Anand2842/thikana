-- Slice 5: message/screenshot extraction receipts.
-- Extracted drafts carry their source request + index; the unique
-- constraint makes retries create no duplicate candidates. Request rows
-- carry a processing lease (one active extraction per broker) and a
-- bounded attempt count. Raw inputs are redacted after 7 days by retention.

alter table listing_drafts add column if not exists source_request_id text;
alter table listing_drafts add column if not exists source_index integer;
drop index if exists listing_drafts_source_unique;
create unique index if not exists listing_drafts_source_unique
  on listing_drafts (source_request_id, source_index);

alter table inventory_requests add column if not exists lease_until timestamptz;
alter table inventory_requests add column if not exists attempts integer not null default 0;
alter table inventory_requests drop constraint if exists inventory_requests_state_check;
alter table inventory_requests add check (state in ('open', 'processing', 'done'));

alter table inventory_requests drop constraint if exists inventory_requests_kind_check;
alter table inventory_requests add check (kind in ('batch-submit', 'bulk-action', 'extract'));

commit;
