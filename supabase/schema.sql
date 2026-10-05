-- Thikana (thikana.rent) · Supabase schema
-- Apply with: psql "$DATABASE_URL" -f supabase/schema.sql
-- Mirrors prisma/schema.prisma. Columns are snake_case; the app maps
-- rows to camelCase types in src/lib/supabase/data.ts.

create table if not exists "brokers" (
  "id" text primary key,
  "name" text not null,
  "agency" text not null,
  "photo" text not null default '',
  "verified" text not null default 'pending',
  "rating" float not null default 0,
  "reviews_count" int not null default 0,
  "recommend" int not null default 0,
  "accuracy" int not null default 0,
  "response_rate" int not null default 0,
  "response_time" text not null default '—',
  "areas" text[] not null default '{}',
  "cats" text[] not null default '{}',
  "exp" int not null default 0,
  "tenure" text not null default '',
  "policy" text not null default '',
  "vdate" text not null default '',
  "complaints" int not null default 0,
  "resolved" int not null default 0,
  "kyc" text not null default ''
);

create table if not exists "listings" (
  "id" text primary key,
  "prop_id" text not null,
  "title" text not null,
  "locality" text not null,
  "sector" text not null default '',
  "bhk" int not null,
  "type" text not null default 'Apartment',
  "rent" int not null,
  "deposit" int not null default 0,
  "furnishing" text not null default '',
  "area" int not null default 0,
  "floor" text not null default '',
  "amenities" text[] not null default '{}',
  "avail" text not null default '',
  "brok" text not null default '',
  "brok_days" int not null default 0,
  "visit_fee" int not null default 0,
  "other_fee" int not null default 0,
  "photos" text[] not null default '{}',
  "broker_id" text not null references "brokers"("id"),
  "hrs" int not null default 0,
  "verification" text not null default 'pending',
  "description" text not null default '',
  "views" int not null default 0,
  "enq" int not null default 0,
  "flags" text[] not null default '{}'
);
create index if not exists "listings_prop_id_idx" on "listings" ("prop_id");
create index if not exists "listings_locality_idx" on "listings" ("locality");

create table if not exists "leads" (
  "id" text primary key,
  "listing_id" text not null references "listings"("id"),
  "broker_id" text not null references "brokers"("id"),
  "user_name" text not null,
  "phone" text not null,
  "req" text not null default '',
  "time" text not null default '',
  "msg" text not null default '',
  "status" text not null default 'New',
  "date" text not null default '',
  "visit" text not null default '—',
  "mine" boolean not null default false
);

create table if not exists "reviews" (
  "id" bigint generated always as identity primary key,
  "broker_id" text not null references "brokers"("id"),
  "user_name" text not null,
  "rating" int not null,
  "text" text not null default '',
  "date" text not null default '',
  "tag" text not null default ''
);

create table if not exists "reports" (
  "id" text primary key,
  "listing_id" text not null,
  "reason" text not null,
  "details" text not null default '',
  "reporter" text not null default '',
  "status" text not null default 'Open',
  "date" text not null default ''
);

-- Row Level Security: public read for catalog content, writes via service_role.
alter table "brokers" enable row level security;
alter table "listings" enable row level security;
alter table "leads" enable row level security;
alter table "reviews" enable row level security;
alter table "reports" enable row level security;

drop policy if exists "public read brokers" on "brokers";
create policy "public read brokers" on "brokers" for select to anon, authenticated using (true);

drop policy if exists "public read listings" on "listings";
create policy "public read listings" on "listings" for select to anon, authenticated using (true);

drop policy if exists "public read reviews" on "reviews";
create policy "public read reviews" on "reviews" for select to anon, authenticated using (true);

-- leads + reports: no anon/authenticated policies → service_role only.
