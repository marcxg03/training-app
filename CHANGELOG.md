# CHANGELOG

## Slice 1 — Project Scaffold + Auth (2026-04-30)

### What was built

- Next.js 15 (App Router) project scaffolded with TypeScript strict mode,
  Tailwind 3.x, and shadcn/ui (new-york style, dark theme).
- Pure black + white + lilac (#9b7fd4) design tokens wired through CSS
  custom properties in `src/app/globals.css` and exposed as Tailwind
  utilities (`bg-background`, `text-foreground`, `bg-accent`, `text-danger`,
  `text-success`, `text-warning`, etc.). Inter font loaded via `next/font`.
  `tabular-nums` and `safe-pb` utilities defined for downstream slices.
- Supabase magic-link authentication via `@supabase/ssr`:
  - Browser client (`src/lib/supabase/client.ts`)
  - Server client (`src/lib/supabase/server.ts`) with cookie bridge
  - Session-refresh helper (`src/lib/supabase/middleware.ts`) called from
    `src/middleware.ts`
- `/login` page with a single-field magic-link form (plain `useState`,
  no React Hook Form). States: idle / sending / sent / error. Inline
  error surfacing on validation failures, Supabase errors, and the
  `?error=link_expired` / `?error=auth` query params from the callback.
- `/auth/callback` route handler exchanges the code for a session, then
  upserts the profile row idempotently
  (`onConflict: "user_id", ignoreDuplicates: true`) before redirecting
  to `/today`.
- `(app)` route group enforces auth: redirects to `/login` if unauthenticated,
  defensively redirects back to `/auth/callback` if the profile row is
  missing (recovery path that re-runs the upsert from the existing session).
- `BottomTabBar` with five tabs (Today, Plan, History, Nutrition, Settings),
  active state via `usePathname()` `startsWith` match, lucide icons,
  44px touch targets, single-source `tabs` array.
- `/settings` Sign out button calls `supabase.auth.signOut()` then
  routes to `/login`; surfaces inline errors if sign-out fails.
- SQL migrations:
  - `001_init_auth_profile.sql` — `goal_mode_enum`, `profiles` table,
    `set_updated_at()` trigger.
  - `007_rls_policies.sql` — SELECT, INSERT, UPDATE policies on
    `profiles` (no DELETE; `auth.users` cascade handles cleanup).
- Tooling: ESLint (next/core-web-vitals + next/typescript), Prettier
  (with `prettier-plugin-tailwindcss`), `.prettierignore` excludes
  `AGENTS.md`, `CLAUDE.md`, `spec/`. Scripts use idiomatic pnpm form
  (`next dev`, `tsc --noEmit`, `prettier --check .`).

### Deviations from the slice spec

- `src/lib/supabase/types.ts` was initially scaffolded as a placeholder
  (`Database = { public: { Tables: {} } }`) with a TODO note pending
  migration application. **Resolved within this slice**: types
  regenerated via `supabase gen types typescript --linked` after the
  migrations were applied to the Supabase project. The file now contains
  the full generated `Database` type including the `profiles` table
  shape and `goal_mode_enum`. No follow-up needed.
- `package.json` scripts were initially generated with full Node paths
  (`node node_modules/next/dist/bin/next dev`, etc.). Reverted to the
  standard form (`next dev`, etc.) during the quality review pass — the
  direct invocation was non-idiomatic and brittle if Next ever moves
  its CLI entrypoint.

### Bugs caught and fixed

- None during the quality review pass. Codex's initial output passed all
  checks; the only changes were the package.json script-style revert and
  the types.ts regeneration noted above.
