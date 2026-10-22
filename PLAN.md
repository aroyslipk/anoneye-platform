# Anoneye plan

Status key: [x] done, [ ] remaining.

1. [x] Scaffold Next.js 16 + TS + Tailwind 4; add lucide-react, zod.
2. [x] Design tokens, dark theme (`app/globals.css`).
3. [x] i18n dictionaries (bn default, en) and provider (`lib/i18n`), theme hook (`lib/theme.tsx`).
4. [x] Provider types, strict URL/username parser, capability registry (`lib/providers`).
5. [ ] App shell: replace the starter `app/layout.tsx` and `app/page.tsx` (fonts Figtree + Hind Siliguri via `next/font`, mount I18nProvider, theme init script, header, footer, logo mark, language/theme toggles).
6. [ ] Landing page `/` with working search form.
7. [ ] `/search` with validation, loading/cancel/retry, honest not-configured state, open-on-platform link.
8. [ ] `/privacy`, `/terms`, `/contact`, `not-found.tsx`, `error.tsx`, manifest + icons.
9. [ ] Unit tests (Vitest) for parser, capabilities, env validation; lint/typecheck/test scripts.
10. [ ] Supabase: migrations with RLS, auth (login/signup/signout), protected routes.
11. [ ] Dashboard, tracked profiles, reports (empty-data states, CSV), settings. Sample data must be labelled as sample.
12. [ ] Meta Graph adapters (Instagram Business Discovery, Facebook Pages), OAuth with state validation, rate limiting.
13. [ ] Sync engine: manual refresh, scheduled function, bounded backoff, snapshots only on real observations.
14. [ ] Media gallery and downloads (only where authorised).
15. [ ] Playwright tests; docs: ARCHITECTURE, API_CAPABILITIES (verify against current Meta docs first), SECURITY, TESTING, DEPLOYMENT.
