# Anoneye

Public-profile discovery and analytics for Instagram and Facebook, using official APIs only. Bangla-first UI with an English switch.

## Status
Foundation only: design system, i18n, theme hook, and the profile-input parser/capability registry. Pages are not built yet. See `PLAN.md`.

## Stack
Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, lucide-react, zod. Planned: Supabase (Auth + Postgres + RLS), Vitest, Playwright, Netlify.

## Run locally
```
npm install
npm run dev
```
Lint: `npm run lint`. No tests exist yet.

## Roadmap
Search flow, legal pages, auth and database, dashboard, tracking, reports, Meta API adapters, sync, media, tests and docs. Details in `PLAN.md`.

## Principles
No scraping, no borrowed sessions, no invented data. Unsupported capabilities (story viewing, profile visitors) are stated as unavailable.
