# Architecture

Anoneye is a Next.js 16 App Router application. It reads public social-media
profiles through official Meta APIs, stores only timestamped observations that
it actually received, and renders those observations as profiles, tracking
lists and reports.

## 1. High-level shape

```
Browser (React 19, Tailwind 4, Bangla-first i18n)
   │  fetch() to same-origin JSON endpoints
   ▼
Next.js server (route handlers, server components)
   ├── lib/api        request validation, error mapping, rate limits
   ├── lib/auth       session resolution (Supabase or local SQLite)
   ├── lib/services   lookup · sync · reports · Meta OAuth
   ├── lib/providers  Instagram / Facebook / demo adapters
   ├── lib/crypto     AES-256-GCM tokens, scrypt passwords
   └── lib/db         Repository interface
          ├── SupabaseRepository (Postgres + RLS, production)
          └── LocalRepository    (node:sqlite, development/demo)
   ▼
Meta Graph API (graph.facebook.com) — public data only, official endpoints
```

The repository interface (`lib/db/types.ts`) is the only persistence contract.
Business logic never imports a concrete database. The local SQLite backend
exists so the app can be run, tested and demoed without any external service;
Supabase is the production path and enforces ownership with RLS.

## 2. Request lifecycle

1. `proxy.ts` (Next 16's renamed middleware) refreshes Supabase cookies and
   applies coarse redirects for `/dashboard`, `/settings` and auth pages.
2. A server component or route handler calls `getSessionUser()`; this verifies
   the session server-side (`auth.getClaims()` for Supabase, a hashed token for
   the local backend). Page-level protection is repeated in the layout, not
   trusted from the proxy alone.
3. Mutating endpoints call `assertSameOrigin()`, parse a bounded JSON body with
   zod (`readJsonBody`, 16 KB), enforce a named rate limit, then check
   ownership through the repository.
4. Errors are converted by `apiError()` into a stable `{ error: { code,
   message } }` shape. Unknown errors become a generic 500; internal messages
   and stack traces never reach the client.

### Route handlers

| Method + path | Purpose |
| --- | --- |
| `POST /api/auth/signup` · `login` · `logout` | Email + password auth |
| `GET /api/profile/lookup?platform=&input=` | Validate + look up one public profile |
| `GET/POST /api/tracked` | List / save a tracked profile (save performs the first sync) |
| `PATCH/DELETE /api/tracked/{id}` | Label/pause, or delete (`?confirm=1`) |
| `POST /api/tracked/{id}/sync` | Manual refresh, backoff-aware |
| `POST /api/tracked/{id}/demo-history` | Only in demo mode; labelled sample history |
| `GET /api/reports/export?tracked=&from=&to=` | RFC 4180 CSV with BOM |
| `GET /api/account/export` | JSON data export (no secrets) |
| `DELETE /api/account` | Deletes data + account (Supabase admin or local) |
| `PATCH /api/settings/profile` | Display name, locale, theme |
| `POST /api/contact` | Honeypot-protected contact message |
| `GET /api/health` | Secret-free status for monitoring |
| `POST /api/cron/sync` | Bearer-protected scheduled sync |
| `GET /api/oauth/meta/start` · `callback` · `POST disconnect` | Meta OAuth |

## 3. Data model

`supabase/migrations/0001_init.sql` is the authoritative schema; the SQLite
schema in `lib/db/local.ts` mirrors it.

```
profiles(user_id → auth.users)
connected_accounts(owner_id, platform, provider_account_id) 1─1 connected_account_secrets(ciphertext)
tracked_profiles(owner_id, platform, identifier) 1─N sync_jobs
                                                1─N metric_snapshots
                                                1─N media_items
reports(owner_id, tracked_profile_id, period_start, period_end, row_count)
contact_messages(write-only through the service role)
tracked_profiles_latest  (view: latest observation per tracked profile)
```

* Every user-data table has `owner_id` and `alter table … enable row level
  security` with four `auth.uid() = owner_id` policies.
* `connected_account_secrets` has RLS enabled and **no policies**, so only the
  service role can read ciphertext.
* Metrics are nullable: `NULL` means “the provider did not return this value”,
  `0` is a real zero. Reports preserve that distinction end to end.
* `(tracked_profile_id, provider_media_id)` is unique so repeated syncs update
  rather than duplicate media metadata.

## 4. Provider adapters

`lib/providers/types.ts` defines the contract. A provider returns a typed
result (`ok | invalid-input | not-configured | unauthorized | rate-limited |
not-found | unsupported | unavailable`) and never throws for expected failures.

* `instagram.ts` — Business Discovery against the connected professional
  account; attempts the richer field set, falls back to documented core fields
  if a field is rejected.
* `facebook.ts` — Page node + `/posts`; a media-permission failure degrades to
  profile-only output with an explicit limitation instead of failing the whole
  lookup.
* `demo.ts` — answers only for the reserved `anoneye.demo` identifier when
  `ANONEYE_DEMO_MODE=1`. It cannot shadow a real handle.
* `graph.ts` — one HTTP client: pinned `graph.facebook.com`, version from
  `META_GRAPH_VERSION`, bearer token, 12 s timeout, 2 MB body cap, `no-store`,
  and Meta error-code classification.
* `capabilities.ts` — the machine-readable truth table used by the UI, docs and
  tests; unsupported capabilities can never be toggled on by configuration.

## 5. Sync engine

`syncTrackedProfile()` performs:

1. Reject a duplicate concurrent run (running job younger than the window).
2. Supersede a queued retry when the user asks for a manual refresh.
3. Create a `sync_jobs` row (`running`), then call the provider.
4. On success: insert **one** snapshot at the provider's observation time,
   replace media metadata, mark job + tracked profile as succeeded.
5. On failure: no snapshot is written. Retryable failures schedule
   `retry_scheduled` with exponential backoff (`2^retry × 30 s`, capped) and a
   maximum of 3 retries; permission/not-found failures fail permanently.

`runScheduledSync()` (used by `/api/cron/sync`) processes due retries first,
then profiles that have never synced or are older than 12 hours, capped per run.
A real deployment should call it from a platform scheduler with
`Authorization: Bearer $CRON_SECRET`; the in-process single-flight guard prevents
overlapping runs inside one instance. Multi-instance deployments should use a
queue/unique job constraint (see SECURITY.md).

## 6. Reports

`buildReport()` loads snapshots for a range (default: last 30 days, maximum
366) and produces:

* `daily[]` — one entry per UTC day with `observed: false` and no metrics when
  there was no sync (missing), or the real values when there was one.
* `weekly[]` — ISO weeks starting Monday, plus post counts from media
  timestamps.
* `change{}` — first/last numeric observation, absolute and percent change,
  and the observation count; percent is omitted when the base is 0.
* `coverage{}` — observed vs missing days.
* `dataNotes[]` — machine codes rendered as translated notes
  (`history-starts-at-first-sync`, `media-list-limited`,
  `engagement-is-current-state`, `likes-missing`, `comments-missing`,
  `zero-engagement-is-genuine-zero`, `demo-fixture-history`).

CSV: UTF-8 BOM, CRLF, RFC 4180 quoting, formula-injection guard, blank for
missing and `0` for zero.

## 7. Rendering and caching

`next.config.ts` enables `cacheComponents` and `partialPrefetching`. Under
these rules any page that reads cookies/headers/search params must either put
that read behind `<Suspense>` or opt out per route with
`export const instant = false`; dynamic pages in this app use the explicit
opt-out so authentication and personal data are never prerendered into a
shared cache.

Client state that affects the first paint (locale, theme) is read through
`useSyncExternalStore` with a deterministic server snapshot, which avoids
hydration mismatches and keeps the static shell prerenderable.

Personal data must never be shared between requests. The dashboard layout and
every personal page call `await connection()` before reading the session, the
session-reading header does the same inside its `<Suspense>` boundary, and
`proxy.ts` returns a real `307` for signed-out visitors. This is verifiable:
personal responses carry `cache-control: private, no-cache, no-store` and never
`x-nextjs-cache: HIT`.

## 8. Internationalisation and theming

* `lib/i18n/dictionaries.ts` defines `en` first and types `bn` as the same
  shape (`Dictionary = typeof en`), so a missing Bangla key is a TypeScript
  error. Bengali is the default; the choice is stored in `localStorage` and,
  when signed in, in the user profile.
* Numbers/dates are formatted with the active locale; ISO timestamps are
  parsed as UTC and never re-interpreted as local time.
* Theme tokens live in `app/globals.css` (`paper`, `ink`, `line`, `accent`,
  `violet`, semantic `ok/warn/bad`). Dark mode is a `.dark` class with an
  inline no-flash script (`THEME_INIT_SCRIPT`).

## 9. Runtime dependencies

* Node 22+ (`node:sqlite` is required by the optional local backend).
* Next.js 16.4, React 19.3, Tailwind 4, zod 4, Supabase JS/SSR.
* No scraping libraries, headless browsers or unofficial APIs are part of the
  runtime or the deployment.
