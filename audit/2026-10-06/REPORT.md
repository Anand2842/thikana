# Settle / Thikana audit — 6 October 2026

**Result: the app builds, but it needs fixes before handling real customer enquiries.** Public endpoints expose enquiry and city-request records, reconfirmation can bypass moderation without a login, and database failures can produce successful submission messages without saving anything.

The product in this repository is branded **Thikana**, an NCR rental marketplace for seekers comparing homes, broker credibility, and charges. Its primary job is to help someone choose a genuinely available home and send an enquiry to the correct broker.

## What was audited

The attached worktree at `/Users/anand/.codex/worktrees/efbf/settle` contained the initial Next.js starter. The actual application was in `/Users/anand/Downloads/settle`, mostly as uncommitted work. I read its pages, components, data helpers, route handlers, authentication, SQL schemas, seed script, configuration, and legacy `index.html` prototype.

Browser coverage included **11 page types, 96 route/query URLs, all 22 seeded listing details, all 12 seeded broker profiles, and every action type in the Next.js UI**. Repeated moderation buttons were exercised on representative records; this is not a claim that every possible data permutation was tested. Mobile checks covered 320px, 375px, and 768px; authenticated pages also covered 1024px. Desktop screenshots used 1440px.

I initially inspected the existing development server using read-only requests. For submissions, role tests, moderation, authentication, outages, and empty data, I copied the app without its environment files and ran a production build against a local Supabase test double. All such writes stayed in the local test double. The tests did not send real OTP emails or mutate the real Supabase database.

During the audit, the source changed from root `middleware.ts` to `src/proxy.ts`. I mirrored the latest proxy, rebuilt, and repeated the route gates and major failures. The final replica's `src` matched the application source. The fresh production route gates work; the earlier development-server exposure is not counted as a current proxy failure.

| Verification | Result |
| --- | --- |
| Production build and TypeScript | Passed, including latest `src/proxy.ts` |
| ESLint | Passed |
| Production dependency advisory scan | 0 reported vulnerabilities at audit time; this does not assess application logic |
| Main flow checks | **38 passed, 28 failed out of 66**; several failures share a root cause |
| Catalog browser scan | Expected pages rendered; invalid listing/broker IDs returned 404 |
| Baseline browser JavaScript errors | None in the stable catalog scan |
| Production admin/broker page gates | Anonymous requests redirected to `/auth?next=…` |
| Moderation API authorization | Anonymous 401; seeker 403 |
| OTP happy path and sign-out | Worked with the local Auth test double |
| Cron secret and threshold behavior | Missing secret rejected; supplied secret worked; 19 listings marked stale when supplied `hrs=200` |
| Rate limit | Eleventh request from the same test IP returned 429 |

[Build log](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/build.log) · [Flow results](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/flows.json) · [Route inventory](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/inspection.json) · [Latest source checks](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/final-checks.json)

## Fix these first

### 1. Critical: private enquiry data is publicly readable

`GET /api/leads` and `GET /api/city-requests` returned **200 without any session**, including each record's phone field. Both handlers use the service-role client, bypassing the SQL policies that intentionally make these tables private. `/dashboard` also renders all leads without checking the user. Its “My Enquiries” section filters a shared `mine` boolean rather than the current user's identity.

The seeded phone values are masked demo strings. The same serialization includes full phone values when real submissions are stored. This was reproduced against the unchanged handlers and the local database contract; no real customer database was queried for new test records.

**Smallest complete fix:** authenticate private reads and restrict the database query to the current seeker or assigned broker. Give each lead an authenticated owner ID; remove the public all-leads pipeline. Keep admin-wide reads behind an explicit admin check.

Sources: [lead GET handler](/Users/anand/Downloads/settle/src/app/api/leads/route.ts:8), [city-request GET handler](/Users/anand/Downloads/settle/src/app/api/city-requests/route.ts:8), [dashboard](/Users/anand/Downloads/settle/src/app/dashboard/page.tsx:3), [private SQL tables](/Users/anand/Downloads/settle/supabase/schema.sql:111).

### 2. Critical: anyone can turn a flagged listing back into a verified listing

An anonymous `POST /api/listings/L007/reconfirm` returned **200** and changed the flagged listing to `verified`. A B1 broker could also reconfirm B8's listing. The handler has no authentication, ownership, or moderation-state check; it performs a service-role update of both `hrs` and `verification`.

**Smallest complete fix:** validate the session and listing ownership in this handler, then refresh availability without overriding `pending` or `flagged` moderation. Only the admin approval path should grant verification.

Source: [reconfirm handler](/Users/anand/Downloads/settle/src/app/api/listings/[id]/reconfirm/route.ts:6).

### 3. High: failed database writes look successful

With the local database returning 503, leads, broker applications, listings, and city requests still returned **201**, generated an ID, and saved no record. Reconfirm also returned 200 with a fabricated updated listing. The browser treats these responses as genuine success. Read helpers likewise substitute the verified demo catalog during database errors without a visible demo indicator.

**Smallest complete fix:** reserve mock behavior for an explicit demo mode. In the configured application, return a failure when a write fails and show a retry message. Do not present fallback sample homes as live inventory during an outage.

Sources: [lead fallback](/Users/anand/Downloads/settle/src/app/api/leads/route.ts:41), [broker fallback](/Users/anand/Downloads/settle/src/app/api/brokers/route.ts:42), [listing fallback](/Users/anand/Downloads/settle/src/app/api/listings/route.ts:49), [city fallback](/Users/anand/Downloads/settle/src/app/api/city-requests/route.ts:39), [read fallbacks](/Users/anand/Downloads/settle/src/lib/supabase/data.ts:67).

## Other important failures

| Priority | Finding and evidence | Minimal correction |
| --- | --- | --- |
| High | **Listing creation trusts the supplied broker ID.** An anonymous request created a pending listing for B2 with 201. Combined with unrestricted reconfirmation, this can publish an impersonated listing. [Handler](/Users/anand/Downloads/settle/src/app/api/listings/route.ts:25) | Require a broker session and derive the broker ID from verified app metadata; allow an explicit admin override only. |
| High | **New-listing enquiries go to the wrong broker.** After creating a B2 listing, its enquiry was persisted for B1. The handler looks up the listing in the static mock array and defaults unknown IDs to B1. [Handler](/Users/anand/Downloads/settle/src/app/api/leads/route.ts:25) | Read the actual listing before creating the lead; reject missing or unavailable listings; use its actual broker ID. |
| High | **A broker without an associated profile can inspect another broker's inbox.** A broker session with an empty broker ID opened `?broker=B2` and saw Saket Homes' dashboard. Invalid associated IDs can also fall back to B1. [Selection](/Users/anand/Downloads/settle/src/app/broker/dashboard/page.tsx:21) | Fail closed for missing/invalid broker associations. Keep the preview selector exclusive to admins. |
| High | **Broker recruitment is blocked for its intended audience.** The anonymous CTA redirects to sign-in; a signed-in seeker is redirected back to sign-in because onboarding requires the broker role. Registration also validates the phone and then discards it; the brokers SQL table has no phone column. [Gate](/Users/anand/Downloads/settle/src/proxy.ts:13), [registration row](/Users/anand/Downloads/settle/src/app/api/brokers/route.ts:27) | Allow a signed-in seeker to submit an application, persist contact details privately, and link the application to the user before later assigning the broker role. |
| High | **The login return URL allows an external redirect.** `/auth/callback?code=…&next=%2F%5Caudit.invalid` returned a 307 to `http://audit.invalid/` after local session exchange. The guard rejects `//` but accepts slash followed by backslash. [Callback](/Users/anand/Downloads/settle/src/app/auth/callback/route.ts:5), [client duplicate](/Users/anand/Downloads/settle/src/app/auth/page.tsx:7) | Reject backslashes or resolve the URL and require the same origin. Apply the same validation to both paths. |
| High | **Freshness does not age with time.** Listings store a fixed `hrs` integer. Creation/reconfirmation set it to zero; nothing increments it or derives it from a timestamp. The cron checks that static value, so a newly reconfirmed listing never naturally becomes stale. [Schema](/Users/anand/Downloads/settle/supabase/schema.sql:50), [cron](/Users/anand/Downloads/settle/src/app/api/cron/expire/route.ts:17) | Store the last availability-confirmed timestamp and calculate elapsed time at read/expiry time. Preserve moderation independently. |
| High | **An empty catalog crashes the homepage.** An empty successful listings response produced HTTP 500 because `listings[0].photos[0]` is accessed unconditionally. Empty broker data can similarly break the broker dashboard fallback. [Home](/Users/anand/Downloads/settle/src/app/page.tsx:43), [dashboard fallback](/Users/anand/Downloads/settle/src/app/broker/dashboard/page.tsx:30) | Guard the selected record and render useful empty-state guidance. |
| High | **New listings cannot collect the information the marketplace promises.** The UI submits only title, city, locality, rent, BHK, and an editable broker ID. It has no photos, deposit, brokerage, visit fees, description, availability, area, or furnishing controls. Even if sent directly, most of those fields are discarded by the API. [Form](/Users/anand/Downloads/settle/src/app/broker/listings/new/page.tsx:30), [saved row](/Users/anand/Downloads/settle/src/app/api/listings/route.ts:31) | Collect and persist the minimum details needed for an honest rental listing; require completeness before approval. |
| High | **Malformed JSON values cause 500s.** Numeric names/phones and `null` bodies reached string operations or property reads. TypeScript assertions do not validate incoming JSON. Five malformed-value probes returned 500. [Validation](/Users/anand/Downloads/settle/src/lib/validation.ts:11) | Check that the body is a non-null object and validate each field's runtime type before using it. Require integer money/BHK values where the SQL columns are integers. |

## Buttons, usability, and trust

| Finding | Reproduction / consequence | Source |
| --- | --- | --- |
| **Sign in opens the wrong page** | Clicking the navbar button opens `/dashboard`, displays the public pipeline, and never presents an email field. | [Navbar](/Users/anand/Downloads/settle/src/components/navbar.tsx:76) |
| **Use a different email immediately sends another code** | After one successful Send code, clicking this control returned to the OTP screen. A browser request counter recorded two OTP requests, rather than allowing the email to be changed. Give the alternate forms distinct identity and prevent a reset click from triggering submission. | [Auth forms](/Users/anand/Downloads/settle/src/app/auth/page.tsx:74) |
| **Locality All does not clear the locality** | From `?city=Delhi&locality=Dwarka`, clicking All keeps `locality=Dwarka`. The `base` object already contains the old locality. Changing locality also loses the selected sort. | [URL construction](/Users/anand/Downloads/settle/src/app/properties/page.tsx:26) |
| **Enquiry transport errors have no feedback** | Aborting the enquiry request produced an uncaught `Failed to fetch`; the form showed no error. Listing, onboarding, and city-request submissions have the same missing catch/finally pattern by source inspection. Their submit controls also lack a busy state. Auth transport errors did release its submit control. | [Contact form](/Users/anand/Downloads/settle/src/components/contact-broker-form.tsx:12) |
| **The enquiry button quotes the wrong fee** | L003 displays a ₹200 visit fee, but its action says `Send enquiry · Visit ₹0`. L007 has a ₹500 visit fee and the same incorrect button label. Pass the actual fee into the form or remove the fee claim from the action. | [Button](/Users/anand/Downloads/settle/src/components/contact-broker-form.tsx:38) |
| **Flagged/pending inventory remains discoverable and contactable** | Price ↑ puts flagged L007 second. Pending L010 appears in public results despite “visible after admin approval” copy. The sort only compares price or fixed hours; it does not apply the advertised moderation de-ranking. | [Results](/Users/anand/Downloads/settle/src/app/properties/page.tsx:16) |
| **Suspension does not flag the broker's listings** | Suspend updates only the broker record. The confirmation promises that existing listings will be flagged, but the inventory update never happens. Approved listings can retain old warning flags. | [Broker update](/Users/anand/Downloads/settle/src/app/api/brokers/[id]/route.ts:34), [confirmation](/Users/anand/Downloads/settle/src/components/admin-actions.tsx:64), [listing approval](/Users/anand/Downloads/settle/src/app/api/listings/[id]/route.ts:18) |
| **Reject can fail for an existing pending broker** | Seeded B7 owns L010. The SQL FK blocks deletion; the API labels all deletion errors “Broker not found.” The local contract test reproduced that misleading alert. This case is supported by the SQL FK, rather than a real Postgres mutation. | [Reject](/Users/anand/Downloads/settle/src/app/api/brokers/[id]/route.ts:28), [FK](/Users/anand/Downloads/settle/supabase/schema.sql:49) |
| **Zero results give little direction** | An unmatched locality shows “0 results” and an empty grid, without a no-matches explanation or clear-filter action. Price sorts work; the empty-result experience needs a small message and reset link. | [Results UI](/Users/anand/Downloads/settle/src/app/properties/page.tsx:69) |
| **Listing cards use stale broker metadata** | Cards resolve brokers from the static mock array even when listings came from Supabase. Newly created broker IDs show no agency/rating; changed broker data disagrees with detail pages. | [Card lookup](/Users/anand/Downloads/settle/src/components/listing-card.tsx:2) |
| **Homepage promises are disconnected from data** | The 24-hour section still showed listings when every record was set to 26 hours. Reviews/recommendation totals are hardcoded. The hero image follows the first catalog row while its price, text, and destination remain L001. Photo-hash/duplicate-check claims have no implemented check in the listing creation path. | [Home selection](/Users/anand/Downloads/settle/src/app/page.tsx:11), [hero](/Users/anand/Downloads/settle/src/app/page.tsx:38), [property ID creation](/Users/anand/Downloads/settle/src/app/api/listings/route.ts:33) |

## Page-by-page coverage

| Page | Controls exercised / inspected | Outcome |
| --- | --- | --- |
| `/` | Main CTAs, five city links, locality links, property/broker links, city request validation and submission | Navigation works; inaccurate data claims, empty-catalog crash, mobile header problems |
| `/properties` | City/locality routes, Freshest, both price sorts, empty results, all property detail links | Price ordering passes; All locality reset and moderation ranking fail |
| `/properties/[id]` | All 22 seeded details, comparison links, broker profile, blank/valid enquiry, network failure, invalid ID | Detail links/404 work; wrong fee label, missing transport feedback, unsafe backend enquiry handling |
| `/brokers` | All cities, verified vs other sections, every seeded profile | Directory renders; no useful empty result guidance; mobile card text is crowded |
| `/brokers/[id]` | All 12 profiles, inventory links, reviews, invalid ID | Rendering/404 work; “active inventory” includes pending/stale records; contact/report/review actions are absent |
| `/dashboard` | Anonymous and seeker views, enquiry ownership, navbar sign-in target | Public global pipeline; new leads lack user ownership; no scheduling/status/review actions |
| `/auth` | Send code, invalid/valid OTP, different email, network failure, return URL | Happy path works locally; different-email and redirect validation fail |
| `/broker/onboard` | Anonymous/seeker gate, broker validation, city select, Continue, Back, submit | Step validation/state work; new broker cannot reach the form through the intended flow; phone is discarded |
| `/broker/listings/new` | Role gate, invalid/valid rent, submit, fields and mobile layout | Submission works against local backend; ownership/completeness/persistence problems |
| `/broker/dashboard` | Gate, own broker selection, demo selector, missing association, reconfirm, new-listing/onboarding links | Valid linked broker stays scoped; missing profile falls back to another inbox; reconfirm bypasses trust state |
| `/admin` | Gate; broker Approve/Suspend/Reject; listing Approve/Expire/Flag; report Uphold/Dismiss; confirmation dialogs | Role checks and most writes pass locally; reject error, suspension behavior, flag cleanup and report counts need attention |

The source contains no Next.js routes for saving properties, posting reviews, submitting reports, changing lead stages, or scheduling visits. Copy promises several of these flows; they remain incomplete product paths. “Notify me at launch” stores a city request, but no launch notification sender exists in this codebase.

## Frontend-design assessment

The desktop hierarchy is clear: homes, fees, and broker identity are visible without opening many panels. Fraunces and Inter load successfully, cards behave consistently, and native keyboard focus is visible. The strongest product-specific element is the comparison of several broker offers for the same property.

The visual direction still uses a familiar cream background, heavy serif headings, and rounded cards. A full restyle would miss the immediate problem: the interface looks more complete and trustworthy than its underlying behavior. Make the existing broker comparison the memorable element, showing the broker's name, actual verification status, fee breakdown, and total move-in cost. Then derive every trust claim from actual data.

Concrete corrections:

- **Header:** at 320px, page width grows to 345–355px; at 768px it grows to 777px anonymously and 816px with a session. At 375px the city badge is split and clipped and actions wrap inside a fixed-height header. Let the brand/actions wrap deliberately or collapse navigation before it becomes too wide.
- **Forms:** 75 field instances in the public route scan had no associated explicit label; many are repeated enquiry fields. Add persistent labels, appropriate phone input/autocomplete attributes, and accessible error/status announcements. Selects need names too.
- **Contrast:** the white launch-notification button text on saffron `#e96a2b` measures approximately **3.20:1**, below 4.5:1 for its 14px text. Pine with white measures approximately 5.34:1. Use the darker saffron token or ink text.
- **Motion:** reduced-motion preference leaves the same card transform transition active. Disable the lift/transition under `prefers-reduced-motion: reduce`.
- **Density:** broker card names and verification pills compete for the same narrow row; allow the name/badge to wrap cleanly. Expose current sort and selected filters accessibly rather than through color alone.
- **Content:** remove the footer's internal migration/Phase 2 implementation text; give customers useful contact/help information. Hide Admin navigation for users who cannot use it. Use consistent action names and truthful fees.
- **Images:** catalog images are eager native images without explicit dimensions/fallbacks in several components. An image-empty new listing has no usable property photograph. Add native lazy loading/dimensions for lower content and a real empty-image treatment; don't add an image framework solely for this.

![Mobile header and hero](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/home-mobile-top.png)

[Desktop homepage screenshot](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/home-desktop.png) · [Price-sort screenshot showing flagged inventory near the top](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/price-sort-top.png) · [Responsive measurements](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/evidence/extra.json)

## Legacy prototype and secondary observations

I also opened `index.html` through a separate local static server, inspected all nine views and all five tabs in both dashboards, and exercised search, saves, demo login, enquiry creation, reporting, and gallery selection. These are prototype checks, separate from the Next.js runtime.

- The advertised `2 BHK under ₹25k in Dwarka` quick search returns **zero results**: it passes the whole sentence into a literal substring search.
- `Verified brokers in Saket` opens property results while the property tab is active.
- Saves/enquiries/reports are in-memory; the test enquiry disappeared on reload. Demo OTP is fixed at `123456`.
- Many prototype buttons only produce a toast: trials, agency contact, file selection, masked calling, chat export, and KYC re-verification have no corresponding service implementation.
- Prototype user-controlled text is interpolated into `innerHTML`; do not turn it into a real multi-user application without escaping or replacing that rendering.

Other source observations: the sitemap advertises dashboard/admin/broker-management pages and every listing state, while robots only excludes `/api/`. Page-specific property/broker metadata is absent. `canAccess('seeker', 'admin')` returns true, although the current proxy's additional explicit admin check prevents that helper mistake from opening `/admin`. Time-suffix IDs repeat every 1,000,000 milliseconds and can collide; use the platform's UUID generation or database-generated IDs. The rate limiter's per-instance scope is already documented, so a Redis migration is not the first fix to make.

The README's “no Supabase env vars” promise does not currently hold: a production build without them completed, but all tested runtime routes returned 500 because session refresh constructs a client unconditionally. Define an honest demo mode or fail startup with a clear configuration error.

## Recommended implementation order

1. Close private reads, authorize creation/reconfirmation, and stop fake success responses.
2. Add real lead/user and broker/user ownership; fix broker routing and onboarding.
3. Separate availability timestamps from verification; enforce complete listing data and trustworthy moderation transitions.
4. Fix login controls/return URLs, filter reset, transport errors, and empty states.
5. Correct mobile layout, labels, contrast, motion, and unsupported product claims.
6. Implement the missing saved/report/schedule/review flows only after the current data paths are sound.

No application source changes were made by this audit. The deliverables are this report, screenshots, result JSON, and runnable local checks. Real Supabase Auth configuration, email delivery, deployed RLS behavior, Vercel scheduling, and production load were not exercised; the local test double validates application behavior, not those external services.

[How to rerun the checks](/Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/RUN.md)
