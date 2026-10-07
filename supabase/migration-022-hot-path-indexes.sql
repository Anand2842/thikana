-- Migration 022: hot-path indexes for inbox/thread/moderation reads.
begin;
create index if not exists lead_messages_lead_idx on lead_messages (lead_id);
create index if not exists lead_reads_user_idx on lead_reads (user_id);
create index if not exists reports_listing_idx on reports (listing_id);
create index if not exists reports_broker_idx on reports (broker_id);
create index if not exists listings_broker_idx on listings (broker_id);
create index if not exists saved_listings_owner_idx on saved_listings (owner_id);
commit;
