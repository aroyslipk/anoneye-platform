# Testing

Everything below was executed in the development container unless a row says
otherwise.

## Results at a glance (2026-10-22)

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **0 problems** |
| Types | `npx tsc --noEmit` | **clean** (strict) |
| Unit + integration | `npm test` | **74 passed / 74** (11 files) |
| Production build | `npm run build` | **success**, all routes emitted |
| Browser E2E | `npm run test:e2e` | **blocked**: no Chromium binary; browser CDN unreachable in this sandbox |
| HTTP smoke test | curl against `next start` | **all pages/handlers behaved as specified** |

### Environment used

Node 22.22.3 · npm 10.9.8 · Next 16.4.2 · React 19.3.0 · TypeScript 5.9.3 ·
vitest 5.0.5 · @playwright/test 1.64.1.

---

## 1. Unit tests (`tests/unit`)

```
npm run test:unit        # vitest run tests/unit
```

| File | What it proves |
| --- | --- |
| `parse.test.ts` | URL/username normalisation, allowlisted hosts only, reserved paths rejected, platform mismatch, scheme rejection (`javascript:`), no ports/credentials |
| `dates.test.ts` | strict `YYYY-MM-DD` parsing (invalid calendar dates rejected), UTC day/week bucketing, report range default 30, max 366, reversed ranges rejected |
| `rate-limit.test.ts` | fixed-window limits, reset after window, key isolation, IP vs user keys via `NextRequest` |
| `crypto.test.ts` | AES-256-GCM round-trip, random IV, tamper detection, malformed payloads, scrypt salting/verification, corrupt hash fails closed |
| `oauth-state.test.ts` | state never embeds the user id in the query, constant-time verification, replay/swap rejection, cookie scope/httponly/10 min, dialog URL scopes and no secret leakage |
| `capabilities.test.ts` | seven capabilities per platform, downloads/stories/visitors permanently unsupported, official source URLs, demo isolation, safe redirect allowlist |
| `env.test.ts` | missing integrations reported honestly, no secret serialisation, Supabase requires both keys, invalid encryption key produces an issue without crashing |

## 2. Integration tests (`tests/integration`)

These use the real local SQLite repository against `:memory:` and the demo
provider; no network access is required.

| File | What it proves |
| --- | --- |
| `ownership.test.ts` | another user cannot read, update, delete, or see snapshots/media; data deletion is scoped to one owner |
| `auth.test.ts` | duplicate email rejected, password never stored in plaintext, unknown email and wrong password are indistinguishable, sessions resolve/revoke, user deletion cascades |
| `sync.test.ts` | snapshot written only after a successful lookup, one snapshot per refresh, duplicate tracking rejected, unmonitorable profile is not left in the list, demo history is idempotent and labelled, scheduled worker stays within its cap |
| `reports.test.ts` | missing day ≠ zero, percent change omitted with one observation, cross-user report is 404, CSV BOM/CRLF/quoting/formula guard, filename sanitisation |

Run everything:

```
npm test                  # vitest run (unit + integration)
npm run test:unit
npm run test:integration
npm run test:watch        # watch mode
```

## 3. End-to-end tests (`tests/e2e`)

Playwright specs cover:

* `landing.spec.ts` — Bangla default, English switch persists, theme toggle
  persists, skip link focus, honest capability copy.
* `search.spec.ts` — demo search end-to-end, gallery has no download button,
  missing credentials explained, post links rejected.
* `auth-flow.spec.ts` — protected redirects, signup → save demo profile →
  tracked list → report + CSV link, wrong password, sign-out.
* `pages.spec.ts` — privacy/terms, contact form, branded 404, manifest/robots/
  sitemap.

First run requires a browser:

```
npx playwright install chromium
npm run test:e2e
```

### Why E2E is marked blocked here

`npx playwright install chromium` fails in this sandbox:

```
Error: Failed to download Chrome for Testing 156.0.8078.4
(playwright chromium v1248), caused by: Download failure, code=1
```

The sandbox only permits an allowlist of hosts and no system browser exists
(`chromium`, `chrome`, `firefox` all absent). The specs are committed and
TypeScript-checked, but **they have not been executed**. Do not treat them as
green until you run them on a machine with browser access.

## 4. Manual HTTP smoke test (executed)

Built app started with the local backend and demo mode:

```
ANONEYE_ALLOW_LOCAL_BACKEND=1 ANONEYE_DEMO_MODE=1 \
ANONEYE_LOCAL_DB_PATH=.data/preview.db \
npx next start -p 3200 -H 0.0.0.0
```

| Request | Expected | Observed |
| --- | --- | --- |
| `/` | 200, Bangla hero | 200 |
| `/search`, `/search?q=nasa&platform=instagram` | 200, honest “not configured” | 200 |
| `/profile/instagram/anoneye.demo` | 200, demo badge, metrics | 200 |
| `/profile/instagram/anoneye.demo/media` | 200, gallery images | 200 |
| `/profile/facebook/anoneye.demo` | 200 | 200 |
| `/privacy`, `/terms`, `/contact`, `/offline` | 200 | 200 |
| `/login`, `/signup` | 200 | 200 |
| `/dashboard`, `/dashboard/tracked`, `/dashboard/reports`, `/settings` while signed out | 307 → `/login?next=…` | 307 |
| `/this-page-does-not-exist` | 404 page | 404 |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` | 200 | 200 |
| `GET /api/health` | `{ok:true, backend:"local", demoMode:true}` | matches |
| `POST /api/auth/signup` → track → sync → report | 200; snapshot per sync | 200 (2-row CSV after first sync) |
| CSV export | `text/csv`, BOM `EF BB BF`, CRLF | matches |
| Cross-user `DELETE /api/tracked/{id}?confirm=1` | 404 | 404 |
| Cross-user `POST .../sync` | 404 | 404 |
| `POST /api/tracked/{id}/demo-history` twice | 14 inserted, then 0 | matches |
| `GET /api/cron/sync` without bearer | 401 | 401 |
| `DELETE /api/tracked/{id}` without `?confirm=1` | 400 | 400 |

Additional checks executed:

* Two signed-in users in separate cookie jars: each dashboard contained its own
  email and never the other's; both responses were `private, no-store`.
* `DELETE` of another user's tracked profile → `404`; export of it → `404`.
* `GET /api/health` → `{"ok":true,"status":"ok","backend":"local",...}`.
* Security headers present on `/`: `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`; no `X-Powered-By`.
* After logout, `/dashboard` returns `307` to `/login?next=%2Fdashboard`.

Screenshots were not captured because no browser is available.

## 5. Defects found and fixed during verification

1. `DELETE /api/tracked/{id}` silently required a JSON body from the client
   (`deleteJson` now sends `{}`; the route itself only needs `?confirm=1`).
2. Demo history could be appended repeatedly; `seedDemoHistory` is now
   idempotent for the recent window.
3. The CSV BOM check initially looked like a failure because `fetch().text()`
   strips the BOM; reading raw bytes confirmed `EF BB BF` is emitted.
4. `javascript:` input fell through to the username validator; the parser now
   rejects non-HTTP schemes with `bad-url`.
5. Turbopack warned that the configurable SQLite path traced the whole project;
   the dynamic path is now marked `turbopackIgnore` (build warning gone).
6. Removed an unused `MEDIA_DOWNLOAD_ENABLED` toggle so the app cannot imply a
   download capability Meta does not authorise. `configStatus().mediaDownload`
   is now a literal `false` and `/settings` shows “disabled”.
7. **Cache leak (critical):** checking response headers showed authenticated
   pages (`/dashboard`, `/settings`) answered signed-out visitors with
   `307` **served from a shared cache** (`x-nextjs-cache: HIT`,
   `s-maxage=31536000`). Fixed with three layers: `await connection()` in the
   dashboard layout and the four personal pages, `await connection()` in the
   session-reading header, and a real 307 redirect from `proxy.ts` when the
   session cookie is absent. Verified: two signed-in users now receive
   `200` with `cache-control: private, no-cache, no-store`; each page contains
   only its own user's email; signed-out requests receive a real `307`.
8. `new Date()` during a shell prerender produced noisy server errors on
   `/dashboard`, `/dashboard/tracked`, `/dashboard/reports` and `/settings` when
   a session cookie was present. The request-time guards in (7) removed the
   errors; the production server log is now clean during the full smoke test.

## 6. What is not covered

* Live Meta API calls, OAuth exchange and PPCA behaviour — no credentials.
* Supabase migrations executed against Postgres — no Postgres/Supabase CLI in
  this sandbox. Apply them on staging before production.
* Real email delivery — contact messages are stored, no SMTP is configured.
* Visual regression / cross-browser checks — only Chromium is configured.

## 7. Definition of done for a change

```
npm run lint && npx tsc --noEmit && npm test && npm run build
npx playwright install chromium && npm run test:e2e   # when a browser exists
```

Never weaken strict mode, delete a failing test, or skip a credential-dependent
check and report it as passed. Mark it blocked and say why.
