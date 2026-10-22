# Security model

Anoneye handles account data and (when configured) OAuth tokens. This document
describes the defences that are implemented, the assumptions they rely on, and
the gaps a production operator must close.

## 1. Trust boundaries

| Boundary | Trusted | Untrusted |
| --- | --- | --- |
| Browser ↔ Next.js | nothing; every request is re-authenticated and re-authorised | all form input, headers, query strings, cookies |
| Next.js ↔ Repository | server code only | — |
| Next.js ↔ Meta Graph API | TLS + pinned hostname | all response bodies (parsed, never executed) |
| Next.js ↔ Supabase | service key kept server-side | RLS decides row access for user-scoped queries |

The browser never receives: `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`,
`TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, access tokens, or ciphertext. Only
`NEXT_PUBLIC_*` values are intended to be public.

## 2. Authentication

* Supabase Authentication (email + password) in production. The app never asks
  for an Instagram or Facebook password; Meta access is OAuth-only.
* Local development backend: `scrypt` password hashes
  (`N=16384, r=8, p=1`, 64-byte key, 32-byte tag), per-password salt.
* Sessions: `anoneye_session` cookie, `HttpOnly`, `SameSite=Lax`, 30-day
  expiry; `Secure` in production when `NEXT_PUBLIC_SITE_URL` is HTTPS. Only a SHA-256 hash of the
  random 32-byte token is stored server-side.
* Supabase sessions are validated with `auth.getClaims()` on the server — not
  `getSession()` — so a forged cookie cannot be trusted client-side.
* Sign-in and sign-up return the same error for unknown email and wrong
  password; verification runs against a dummy hash for unknown users to avoid a
  timing oracle.
* Sign-out removes the server-side session row (local) or revokes the Supabase
  session, then clears the cookie.

## 3. Authorisation

* Every dashboard route is protected in the server layout, independently of
  the proxy redirect.
* Personal pages are forced to render per request (`await connection()` in the
  layout and the pages themselves), so a CDN cannot serve one user's dashboard
  to another. Regression check: response headers must show
  `cache-control: private, no-cache, no-store`, and two users' pages must each
  contain only their own email.
* Every repository method that returns user data takes `ownerId`/`userId` and
  filters by it. Route handlers additionally load the resource with the
  session user's id before mutating, returning `404` for another user's row
  (no existence leak).
* Supabase RLS enforces the same rule in the database: four per-table policies
  (`select/insert/update/delete`) using `auth.uid() = owner_id`.
  `connected_account_secrets` and `contact_messages` have RLS enabled and no
  policies, so authenticated clients cannot read them at all.
* Tests cover cross-user reads, updates, deletes, reports and exports
  (`tests/integration/ownership.test.ts`).

## 4. Request forgery and redirects

* Mutating endpoints require a same-origin `Origin` header; if absent, a
  `Sec-Fetch-Site` value of `same-origin` or `none`. Combined with
  `SameSite=Lax` cookies this blocks classic CSRF.
* JSON bodies must declare `Content-Type: application/json` and are capped at
  16 KB; wrong content type → `415`, oversized → `413`.
* Post-login redirects only accept an allowlist (`/dashboard`,
  `/dashboard/tracked`, `/dashboard/reports`, `/settings`) plus public profile
  paths matching a strict pattern. External and protocol-relative URLs are
  discarded.
* The Meta OAuth callback validates a signed, httpOnly, 10-minute state cookie
  and that the state belongs to the signed-in user; the authorization code is
  exchanged server-side.

## 5. Input validation and SSRF

* All user input is validated with zod before use. Profile input accepts only
  allowlisted hosts (`instagram.com`, `www.instagram.com`, `m.facebook.com`,
  `facebook.com`, `fb.com`, …), rejects credentials/ports, rejects post/story
  paths and normalises the handle.
* The server never fetches a URL supplied by a user. Provider requests are
  constructed from a fixed base (`https://graph.facebook.com`), a validated
  version string and a percent-encoded identifier. Response `media_url` values
  are only rendered when they are HTTPS on `*.cdninstagram.com` /
  `*.fbcdn.net`; permalinks must be on the platform's own domain.
* Media are rendered as `<img>` with `referrerpolicy="no-referrer"` and
  `loading="lazy"`; Anoneye never proxies or rehosts them.

## 6. Output safety

* React escapes all interpolated text. The only `dangerouslySetInnerHTML` use
  is the constant `THEME_INIT_SCRIPT` (no user data).
* Captions, labels and error messages are rendered as text, never as HTML.
* API responses use `Cache-Control: no-store` and `X-Content-Type-Options:
  nosniff`. Unknown errors return a generic message without stack traces.
* CSV exports start with a UTF-8 BOM and neutralise formula-leading cells
  (`=`, `+`, `-`, `@`) to prevent spreadsheet injection.

## 7. Secrets at rest and in transit

| Secret | Storage | Notes |
| --- | --- | --- |
| Supabase service key | env only | server-only, never bundled |
| Meta app secret | env only | used for code exchange and app tokens |
| OAuth access tokens | AES-256-GCM ciphertext in `connected_account_secrets` | key = `TOKEN_ENCRYPTION_KEY` (32-byte base64); format `v1.iv.tag.data` |
| User passwords | scrypt hash | never logged or returned |
| Cron secret | env only | ≥16 chars, bearer comparison |

* Logs are structured and redacted: keys matching
  `token|secret|password|authorization|cookie|api-key|session` become
  `[redacted]`; bearer tokens and `access_token`/`code` query values are
  scrubbed; provider response bodies are never logged.
* `TOKEN_ENCRYPTION_KEY` rotation makes existing connections unreadable; users
  must reconnect (documented, not silently ignored).

## 8. Rate limiting and abuse

Fixed-window limits per named action (per user when signed in, otherwise per
IP): signup 8/15 min, login 10/15 min, lookup 30/min, save 20/min, sync 8/min,
CSV export 10/min, contact 3/hour, OAuth start 10/min, callback 20/min,
disconnect 10/min. Exceeding a limit returns `429` with `retryAfterSeconds`.
Contact messages include a hidden honeypot field that silently rejects bots.

**Limitation:** the limiter is in-process. It is correct for one Node
instance. A horizontally scaled deployment must replace the store with Redis or
a provider-level limiter; otherwise each replica has its own budget.

## 9. Headers

`next.config.ts` sends `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control:
off` and a restrictive `Permissions-Policy`; `X-Powered-By` is disabled.
`X-Frame-Options` / `frame-ancestors` are intentionally not set because the
hosted preview embeds the app in an iframe. Add both if you deploy standalone.

A nonce-based CSP is not configured (Next's inline bootstrap scripts require
careful nonce plumbing). Treat this as a deployment hardening task.

## 10. Scheduled worker

`POST /api/cron/sync` requires `Authorization: Bearer $CRON_SECRET` with a
constant-time-ish comparison and refuses secrets shorter than 16 characters.
An in-process single-flight guard returns `409` while a run is active; the
worker itself is bounded to 10 profiles per call. On a multi-instance
deployment, ensure only one scheduler runs, or add a database advisory lock.

## 11. Data lifecycle

* **Export:** `GET /api/account/export` returns profile, connections, tracked
  profiles, snapshots, media metadata, sync jobs and reports — never token
  ciphertext or password hashes.
* **Delete:** `DELETE /api/account` requires a typed confirmation, revokes
  sessions and deletes auth + data (`on delete cascade` / explicit transaction).
* **Logs:** outlive the request only as structured events; no tokens or
  cookies are included.
* **Retention:** snapshots are kept until the user deletes the tracked profile
  or the account. Add a retention job if your policy requires one.

## 12. Legal constraints encoded in the product

Anoneye does not scrape, does not fetch private content, does not use borrowed
sessions, does not offer story viewer lists or profile visitors, and does not
download third-party media. This is not a limitation of effort — Meta's terms
and API surface do not permit it. See `docs/API_CAPABILITIES.md`.

## 13. Known gaps / risk register

| Risk | Status | Mitigation |
| --- | --- | --- |
| Supabase path never executed against a live project here | Unverified | Migrations reviewed; run them on staging and exercise RLS tests first |
| In-process rate limiter | Accepted for single instance | Replace with shared store when scaling |
| No CSP | Accepted | Add nonce-based CSP at the proxy/edge |
| OAuth state cookie only | Standard | Add PKCE if Meta supports it for this flow |
| Cookies are not `__Host-` prefixed | Accepted | Rename on a custom domain |
| Contact form has no email delivery | By design | Messages are stored; no outbound mailer is configured |
| No virus scanning of user uploads | N/A | The app accepts no file uploads |

## 14. Reporting a vulnerability

Do not open a public issue for a security problem. Contact the operator using
the address configured in `NEXT_PUBLIC_CONTACT_EMAIL` (or the contact form) and
allow reasonable time for a fix before disclosure.
