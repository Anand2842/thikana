# Thikana

Thikana ([thikana.rent](https://thikana.rent)) is NCR's verified broker marketplace —
property search across Delhi, Gurugram, Noida, Greater Noida & Ghaziabad with verified
brokers, transparent charges, and fresh availability.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (Postgres + Auth) · Vercel

## Local dev

```bash
npm i
npm run dev        # http://localhost:3000
```

Copy `.env.example` to `.env` (never commit `.env`) with:

| Var | Example |
| --- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` (server only) |
| `CRON_SECRET` | any long random string (optional locally) |

Without Supabase env vars the app runs on built-in mock data.

```bash
npm run seed       # load prototype dataset into Supabase (needs .env + service key)
```

## Deploy on Vercel

1. Import the repo in Vercel (framework preset: Next.js).
2. Set the env vars above in Project Settings → Environment Variables,
   including `CRON_SECRET` (generate with `openssl rand -hex 32`).
3. Deploy. The daily stale-listing cron (`POST /api/cron/expire`, `0 2 * * *`)
   is auto-configured via `vercel.json`. Vercel Cron sends
   `Authorization: Bearer <CRON_SECRET>`; the route enforces it only when
   `CRON_SECRET` is set (local dev stays open).

## Roles

Roles live in `auth.users` app metadata: `{ role: "admin" | "broker" | "seeker", broker_id?: "B1" }`.
Default is `seeker`. Assign in the Supabase dashboard (Authentication → Users) or via SQL:

```sql
-- make a user an admin
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';

-- link a broker user to their broker profile
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"broker","broker_id":"B1"}'::jsonb
where email = 'broker@example.com';
```

Test accounts: create users via Supabase Auth (sign up in the app or dashboard),
then assign roles with the SQL above. No shared credentials are stored in the repo.

## Hardening notes

- `POST /api/leads`, `/api/brokers`, `/api/listings`, `/api/city-requests` are
  rate-limited to 10 req/min per IP (in-memory; see `src/lib/ratelimit.ts`).
  For exact global limits across Vercel instances, upgrade to Upstash Redis later.
