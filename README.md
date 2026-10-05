# Thikana

A working NCR rental marketplace built with Next.js 16, React 19, Tailwind 4 and Supabase. The supplied catalog is sample data, identified by the demo banner. Enquiries, saves, applications, uploads, visits, reviews and moderation persist in Supabase.

## Run

```sh
npm ci
# Configure .env using .env.example.
npm run migrate       # Requires psql and DATABASE_URL; additive migrations.
npm run seed          # Adds missing sample records; preserves existing records and reviews.
npm run demo          # Creates isolated test accounts, with private random passwords.
npm run dev
```

Demo credentials and walkthroughs are in `.local/DEMO.md` and `.local/demo-accounts.json`, which are ignored by Git and deployment. Choose **Password** on `/auth`. The seeker has a new enquiry and a completed visit ready for a review. The broker is linked to `B1`; the admin can inspect all queues. `other` exercises isolation; `applicant` can submit a broker application. Rerunning `demo` resets only these marked demo accounts to their original roles, preserving their saved passwords. Never use the demo admin as a public shared account.

## Working flows

- Search available homes by city, locality, keyword, BHK, budget and furnishing; sort by price or freshness.
- Inspect galleries, all fees and move-in totals; compare offers sharing a property ID.
- Sign in using email link/code or password. Save homes, enquire, schedule or reschedule visits and report problems.
- Both seeker and assigned broker independently confirm a past visit. One review per confirmed enquiry; ratings update from stored reviews.
- Brokers submit masked identity and business proof to private storage. Staff reviews before approval. Pending or suspended applicants can resubmit; approved brokers create listings with photos and every fee disclosed.
- Brokers see their own inventory and assigned enquiries. Reconfirmation refreshes only approved inventory. Pending/flagged records require staff review.
- Admin approvals, expiry, flags, suspension/rejection and report resolution write to Supabase. Suspension retains records and flags owned inventory. Listing/address submission and report moderation use database transactions.

## Checks

```sh
npm run lint
npm run check
npm run build
npm start
```

Browser evidence and reproducible Playwright checks are in `audit/completion/`. They cover public pages, all roles, persistence, upload validation, moderation, mobile layouts, keyboard/reduced motion and network failures. They use real Supabase plus an isolated QA account. See `audit/completion/RESULTS.md` for exact coverage and limitations. Historic findings and the retired static prototype are in `audit/2026-10-06/`; the prototype is not served by the app.

## Deploy

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_DEMO_MODE` in your hosting environment. The service key remains server-only. Set the site URL to your actual domain. Keep the demo banner until sample records are replaced.

In Supabase Authentication, allow your app's `/auth/callback` URL and configure your email provider/template for production delivery. Password and code verification use Supabase Auth; browser QA generates test OTPs without sending email. Identity verification is performed by your staff; the app does not claim automated government eKYC.

Vercel's daily cron is configured in `vercel.json`. The expiry endpoint always requires `Authorization: Bearer <CRON_SECRET>`. Homes disappear from search after seven days even before cron runs because freshness is calculated from a timestamp.

The rate limiter provides bounded, per-instance spam friction. Use shared rate-limit storage when deploying multiple instances and needing a strict global limit. No extra runtime dependencies were added.
