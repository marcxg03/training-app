# DECISIONS

## Slice 1 — Project Scaffold + Auth

### Profile auto-creation lives in the auth callback, not in the (app) layout

The `/auth/callback` route handler runs the profile upsert
(`onConflict: "user_id", ignoreDuplicates: true`) immediately after
`exchangeCodeForSession`. The `(app)` layout treats a missing profile
as a recovery case and redirects back to `/auth/callback`, which
re-runs the upsert from the existing session and forwards to `/today`.

**Options considered**

1. Upsert in `/auth/callback` only (chosen).
2. Upsert in `(app)` layout on every request.
3. Upsert in a Postgres trigger on `auth.users` insert.

**Reasoning**
Option 2 runs an extra write on every authenticated request — wasteful
even with `ignoreDuplicates`. Option 3 couples the app to Supabase's
internal auth schema and makes the upsert invisible from the codebase,
which hurts onboarding for a personal-first project. Option 1 keeps the
write in one obvious place, the callback that already runs once per
sign-in, with a defensive recovery path in the layout for the edge case
where a session exists but the profile row was never written.

### Single-field forms use plain `useState`, not React Hook Form

The `LoginForm` is one email input. RHF + Zod is the project standard
for multi-field forms (per AGENTS.md rule 8) but adds dependency weight
and ceremony for a single field.

**Reasoning**
Personal-first project — keep dependencies and indirection minimal where
the simpler primitive is sufficient. RHF arrives in the slice that
introduces the first multi-field form (likely the workout/log forms in
later slices).

### Env-var getter duplication left in place across the three Supabase files

`getSupabaseUrl()` and `getSupabaseAnonKey()` are defined identically in
`src/lib/supabase/client.ts`, `server.ts`, and `middleware.ts`.

**Options considered**

1. Leave as-is (chosen).
2. Extract to a shared `src/lib/supabase/env.ts` helper.
3. Inline the env reads at point of use.

**Reasoning**
Three small copies (~14 lines each) within one folder. Extraction would
add a fourth file to the supabase/ directory for marginal benefit;
inlining loses the explicit "Missing X" error message. Trigger for
extraction is the fourth Supabase file (likely Slice 2's seed script or
Slice 3's data-access helpers), at which point the duplication crosses
the threshold where a shared helper pays for itself.

### Package scripts use idiomatic form, not full Node paths

Scripts are `"dev": "next dev"`, `"typecheck": "tsc --noEmit"`, etc.,
relying on pnpm's `node_modules/.bin` resolution.

**Reasoning**
The full-path form (`node node_modules/next/dist/bin/next dev`) breaks
silently if Next ever moves its CLI entrypoint and is non-standard for
pnpm projects. The idiomatic form is the convention every contributor
expects.
