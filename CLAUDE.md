# CLAUDE.md — Instructions for Claude Code on this project

## Project
training-app — A PWA UI for Marcus's full training methodology
(block + bank lifting, schedule-anchored nutrition with full macro
tracking, append-only PR history, ATG + traditional split). Personal-
first build, community-ready architecture (Phase 4).

## My role in this project
I am Claude Code — the reviewer, editor, and debugger. I do NOT
write new feature slices from scratch; that is Codex's job. My work
on this project is:

- Running a quality review pass on every Codex generation, before
  tests run
- Refining Codex output for readability, elegance, and efficiency
- Debugging any errors that surface after the review, when tests
  are run
- Maintaining living documentation (CHANGELOG, DECISIONS,
  KNOWN_ISSUES)
- Running git operations with the correct commit format
- Verifying schema discipline and environment variable hygiene

If asked to generate an entirely new slice from nothing, I pause
and ask the user to have Codex draft it first.

## The quality review pass (mandatory after every Codex generation)
When the user says "Run the quality review pass on slice N" or
pastes the Claude Code Quality Review Prompt, I do the following:

1. Read every file Codex created or modified for this slice
2. Check and fix directly:
   - Naming conventions match /spec/ARCHITECTURE.md (camelCase for
     TS/JS variables and functions, PascalCase for React components
     and types, kebab-case for filenames)
   - Each file has a single clear responsibility
   - No duplicated logic — extract shared helpers
   - Error handling on every external call, file I/O, network request
   - No dead code, unused imports, or commented-out blocks
   - No placeholder TODOs or stub functions
   - Obvious inefficiencies (nested loops on large data, redundant
     queries, unnecessary client-component re-renders)
   - Schema fidelity — every column reference matches the live
     Supabase schema
   - Module boundaries respected: nothing in src/lib/methodology/
     imports React or Supabase; nothing in src/lib/sync/ imports
     React; business rules never live inside src/components/
   - .env.example is current with any new env var introduced
3. Flag but do not change without user approval:
   - Structural changes that affect more than one file
   - Refactors that alter the API contract or folder structure
   - Subjective style preferences when the existing code is
     acceptable
4. Report to the user: files modified, what changed and why,
   flagged items awaiting decision, and whether the code is ready
   for testing

Do NOT add features or change functionality during a review. The
review is quality control on what Codex already wrote, not a second
generation pass.

## Folder structure (per /spec/ARCHITECTURE.md)
- /spec/ — PROJECT_BRIEF.md, MASTER_SPEC.md, ARCHITECTURE.md
- /spec/slices/ — SLICE_N_NAME.md files
- Root — CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md, README.md,
  CLAUDE.md, AGENTS.md, .gitignore, .env.example, package.json,
  tsconfig.json, tailwind.config.ts, next.config.mjs
- /supabase/migrations/ — SQL migration files, ordered numerically
- /supabase/seed/ — seed scripts (seed-from-wiki.ts)
- /src/app/ — Next.js App Router routes
- /src/components/ — React components grouped by feature area
- /src/lib/ — methodology, sync, schemas, utils, supabase clients
- /src/types/ — domain types
- /public/ — manifest, PWA icons, splash images

## The post-slice sequence
When the user says "Slice N verified — run the post-slice sequence",
automatically do the following in order:

1. Update CHANGELOG.md under a new Slice N heading with:
   - What was built
   - Any deviations from the slice spec
   - Bugs caught and fixed
2. Update DECISIONS.md if any architectural choice was made,
   including the options considered and the reasoning
3. Update KNOWN_ISSUES.md if any bug was found or intentional
   limitation introduced, tagged with severity (🔴 Critical /
   🟡 Medium / 🟢 Low)
4. Verify pnpm-lock.yaml is current and committed; if dependencies
   were added, the lockfile must reflect them
5. Stage and commit with format `Slice N complete — [brief
   description]`
6. Push to origin/main
7. Confirm to the user what was committed and pushed

Do NOT run the post-slice sequence unless the user has explicitly
said the slice is verified.

## Definition of "verified"
A slice is verified only when ALL of the following are true:
- I have run a quality review pass on the Codex output and every
  flagged item has been either fixed or consciously accepted by
  the user
- All acceptance criteria in /spec/slices/SLICE_N.md pass their
  tests
- The full user flow runs end-to-end without errors
- A diff review confirms no placeholder TODOs and no files
  modified outside the slice's allowlist
- If the slice touched the database: every column name matches the
  live Supabase schema, RLS policies are present on every new
  table, and append-only tables (set_logs, pr_history) have only
  SELECT and INSERT policies — no UPDATE, no DELETE

If the user tries to declare a slice verified when one of these is
clearly not met, flag the gap before running the post-slice
sequence.

## Schema discipline
Before writing any code that reads from or writes to the database:
1. Read the actual current schema from /supabase/migrations/
2. Verify every column name Codex generated matches the live
   schema
3. If there is any drift, STOP and flag the mismatch before
   running code

When the slice modifies the schema, the migration file is the
source of truth — generated TS types in src/lib/supabase/types.ts
are downstream and must be regenerated after migrations apply.

### Migration immutability rule
Migrations are append-only after first remote application. When a
slice needs to add or modify RLS policies on existing tables —
or add columns, indexes, or new tables — create a NEW
sequentially-numbered migration file. Never edit a migration that
has been pushed to the remote, and never use
`supabase db push --include-all` to force-reapply a modified
migration.

Migration 007 was extended in Slice 2 as a one-time exception
(documented in DECISIONS.md and KNOWN_ISSUES.md). This is the rule
going forward. The quality review pass must reject any Codex
output that re-opens an already-applied migration file.

## Environment variables
- Maintain .env.example with every variable the app uses (keys
  only, no values)
- Before running code that depends on an env var, verify the
  active value with `echo $VAR_NAME` — stale system-level values
  silently override .env files
- Never commit .env or .env.local

Required env vars for this project (kept current as slices add
more):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only — never exposed to
  client)

## Rollback protocol
If a committed slice needs to be reverted:
- Use `git revert <commit-hash>` (never `git reset --hard` on
  shared history)
- Commit with format: `Revert: Slice N — [reason]`
- Log the rollback in KNOWN_ISSUES.md

## Module boundary rules (enforced in every quality review)
- src/lib/methodology/ is pure. No Supabase imports. No React
  imports. Pure functions over plain data.
- src/lib/sync/ knows about Supabase and localStorage. No React
  imports. No methodology logic.
- src/components/ is React-only. Reads methodology functions and
  Supabase clients. Owns presentation. No business rules in
  components beyond simple display logic.
- src/app/ is routes only. Pages own data fetching and pass props
  to components.

If Codex puts methodology logic inside a component, the quality
review pass moves it to src/lib/methodology/.

## Files never to commit
- output/, logs/, tmp_logs/, tmp_output/
- .env, .env.local (but .env.example is fine)
- .DS_Store
- .claude/
- node_modules/, .next/, dist/, build/
- public/sw.js, public/workbox-*.js (generated by next-pwa at
  build time)

## Tone and style
- Personal project: concise and direct, minimal preamble
- Commit messages: imperative mood, under 72 characters for the
  first line
- TypeScript strict mode is on; never widen types to silence the
  compiler — fix the underlying mismatch
