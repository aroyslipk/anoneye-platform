<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Anoneye project notes

- Read `PLAN.md` first; it lists done and remaining milestones.
- `lib/providers/parse.ts` is the single place for URL/username parsing (exact host allow-lists). `registry.ts` holds honest capability statuses; do not mark something "available" unless it works without credentials.
- All UI copy lives in `lib/i18n/dictionaries.ts` (Bangla default). Add keys to both locales.
- Styling uses CSS variables in `app/globals.css` exposed as Tailwind colours (`bg-paper`, `text-ink`, `bg-accent`...).
- Never show sample data as real; never fabricate API results.
- `app/layout.tsx` and `app/page.tsx` are still the create-next-app starter and must be replaced (starter assets in `public/` were deleted).
