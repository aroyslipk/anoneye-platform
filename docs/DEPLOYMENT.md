# Deployment

Anoneye runs as a standard Node.js Next.js app. Any host that supports Node 22+
works (Vercel, Netlify, Fly.io, Render, a VPS). This guide uses Vercel +
Supabase because that combination needs the least infrastructure.

> **Deployment status:** nothing in this repository has been deployed. The
> instructions below are the exact steps an operator must perform; they have
> not been executed or verified from this environment.

---

## 0. Two supported modes

| Mode | Database | Auth | Use case |
| --- | --- | --- | --- |
| Local / single instance | SQLite file (`ANONEYE_LOCAL_DB_PATH`) | Local scrypt + sessions | Development, demos, a single-tenant internal tool |
| Production | Supabase Postgres | Supabase Auth | Multi-user public deployment |

The local backend is refused automatically when `NODE_ENV=production` unless
`ANONEYE_ALLOW_LOCAL_BACKEND=1`; do not enable it for a public multi-user site.

---

## 1. Supabase project

1. Create a project at <https://supabase.com>; note the project URL and the
   **publishable** (anon) key.
2. Enable **Email** authentication. Decide whether email confirmation is
   required (if enabled, new users must confirm before signing in).
3. Apply the schema. Either paste the two files in `supabase/migrations/` into
   the SQL editor in order, or use the CLI:

   ```
   supabase link --project-ref <ref>
   supabase db push
   ```

4. Verify RLS:

   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   -- every table should show rowsecurity = true
   select * from pg_policies where schemaname = 'public';
   ```

5. Authentication → URL configuration:
   * Site URL: `https://your-domain.example`
   * Redirect URLs: `https://your-domain.example/auth/callback`
     (and `http://localhost:3000/auth/callback` for local testing).
6. Copy `SUPABASE_SERVICE_ROLE_KEY` from Project settings → API. It is
   server-only; never prefix it with `NEXT_PUBLIC_`.

---

## 2. Meta / Instagram / Facebook app

Live lookups require a Meta app. Nothing here can be tested without one.

1. Create an app in the Meta developer console (type: **Business**).
2. Add the **Facebook Login** and **Instagram API with Facebook Login**
   products.
3. Facebook Login → Settings → Valid OAuth Redirect URIs:
   `https://your-domain.example/api/oauth/meta/callback`
4. Request the permissions used in `lib/services/meta-oauth.ts`:
   `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`,
   `pages_show_list`, `public_profile`.
5. For arbitrary public Facebook Pages, request **Page Public Content Access**
   (App Review + business verification). Without it, only Pages whose admin
   holds a role in your app are readable.
6. Submit the app for review as required by Meta, then switch it to Live.
7. Copy `META_APP_ID` and `META_APP_SECRET`.
8. (Optional) For server-side lookups without per-user OAuth, create a
   long-lived token, set `META_ACCESS_TOKEN`; for Instagram also set
   `INSTAGRAM_BUSINESS_ID` (your own professional account id).

> Instagram Business Discovery can only read **Business/Creator** targets. No
> permission level unlocks consumer or private accounts. See
> `docs/API_CAPABILITIES.md`.

### OAuth token key

Generate once and store as a secret:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it as `TOKEN_ENCRYPTION_KEY`. Losing it means every connected account must
reconnect; changing it invalidates existing ciphertext.

---

## 3. Environment variables

Copy `.env.example` and fill in. Required for production:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://…`, no trailing slash; used in metadata + OAuth |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | must be set together with the URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | tokens, cron, contact messages |
| `META_APP_ID`, `META_APP_SECRET` | for OAuth/live lookups | server-only |
| `META_REDIRECT_URI` | for OAuth | must match the Meta console exactly |
| `TOKEN_ENCRYPTION_KEY` | for OAuth | 32-byte base64 |
| `CRON_SECRET` | for scheduled sync | ≥16 characters |
| `ANONEYE_DEMO_MODE` | optional | keep `0` in production |
| `ANONEYE_ALLOW_LOCAL_BACKEND` | no | leave unset in production |
| `NEXT_PUBLIC_CONTACT_EMAIL` | optional | shown on `/contact` |

Start-up validation is non-fatal by design: the app builds and renders without
secrets, and each feature reports “not configured”. `GET /api/health` returns
the exact missing pieces.

---

## 4. Build and deploy

```
npm ci
npm run lint && npx tsc --noEmit && npm test && npm run build
npm run start -- -p 3000
```

On Vercel: import the repository, add the environment variables, deploy. The
build command is `npm run build`; Node 22+ must be selected.

Checklist after the first deploy:

- [ ] `GET /api/health` returns `ok: true`, `status: "ok"`, `backend: "supabase"`, `issueCount: 0`
- [ ] `/` renders in Bangla; the language switch persists
- [ ] Sign up, sign out, sign in; `/dashboard` is protected
- [ ] Save a **test** profile you own; verify a snapshot appears
- [ ] Reports page shows the observation and downloads a CSV
- [ ] A second account cannot read the first account's tracked profile or CSV
      (open the URL directly)
- [ ] OAuth connect/disconnect works and stores ciphertext, not plaintext:
      `select ciphertext from connected_account_secrets limit 1;`
- [ ] `ANONEYE_DEMO_MODE` is off in production
- [ ] `select count(*) from metric_snapshots where source ilike 'Anoneye demo seed%';`
      returns 0

---

## 5. Scheduled sync

The worker is an HTTP endpoint. Any scheduler works:

```
curl -X POST https://your-domain.example/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel `vercel.json` example (once per day; adjust to your plan):

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Vercel Cron does not send custom headers on the Hobby plan; use a secret query
parameter only if your plan cannot set headers, or call the endpoint from an
external scheduler. Do not expose the worker without a secret. Ensure a single
scheduler fires per interval; the worker caps itself at 10 profiles per run.

---

## 6. Operational notes

* **Backups:** enable Supabase automated backups; the SQLite file must be
  copied if you run the local backend.
* **Monitoring:** poll `/api/health` and alert when `status` is `degraded` (`ok: false`, `issueCount > 0`).
* **Logs:** structured JSON; tokens are redacted. Do not log request headers
  in front of the app.
* **Rate limiting:** in-process. For multiple replicas, wire
  `lib/security/rate-limit.ts` to a shared store before scaling.
* **Retention:** delete `metric_snapshots`, `media_items`, `sync_jobs` and
  `reports` when a user deletes a tracked profile/account; cascade handles this
  in Postgres. Demo rows are ordinary rows and must be removed manually if you
  ever enabled demo mode against a production database:

  ```sql
  delete from metric_snapshots where source ilike 'Anoneye demo seed%';
  ```

* **Key rotation:** replacing `TOKEN_ENCRYPTION_KEY` makes stored connections
  undecryptable; mark them disconnected and ask users to reconnect. Never
  silently fall back to plaintext.
* **Security headers:** add `X-Frame-Options`/`frame-ancestors` and a nonce CSP
  if you deploy standalone (they are omitted here to keep the hosted preview
  embeddable).

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| “Live lookup is not configured” | Meta env vars missing or partial | set all four OAuth values + `TOKEN_ENCRYPTION_KEY` |
| OAuth redirects with `oauth=no_pages` | Meta account manages no Pages | use an account with a Page/IG professional profile |
| `oauth=state_mismatch` | stale/duplicate callback tab | start the flow again in one tab |
| `oauth=not_configured` | missing app id/secret/redirect | check `.env` and Meta console |
| `401` from `/api/cron/sync` | missing/incorrect bearer or too-short secret | compare `CRON_SECRET` on both sides |
| `503` with `SUPABASE_SERVICE_ROLE_KEY` | key not set | add it; required for token storage and cron |
| Reports are empty | no successful syncs in the range | run “sync now”; history starts at the first sync |
| Demo profile returns 404 | demo mode off or wrong handle | use `anoneye.demo` with `ANONEYE_DEMO_MODE=1` |
| Build fails on Node 20 | `node:sqlite` unavailable | use Node 22+ |

---

## 8. Rollback

Deploy the previous build; database migrations are additive. If you must roll
back the schema, drop the new tables/views in reverse order after taking a
backup. Token ciphertext is versioned (`v1.`), so a future format change can be
detected and migrated rather than silently misread.
