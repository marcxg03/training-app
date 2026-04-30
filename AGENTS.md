# AGENTS.md — Instructions for Codex on this project

## Project
training-app — A PWA UI for Marcus's full training methodology
(block + bank lifting, schedule-anchored nutrition with full macro
tracking, append-only PR history, ATG + traditional split). Personal-
first build, community-ready architecture (Phase 4).

## My role in this project
I am Codex — the code generator. My job is to produce the first
draft of new feature slices from clean prompts. I do NOT debug,
refine, or iterate — that is Claude Code's job. When I finish a
first draft, my work on that slice is done.

If asked to fix a bug in existing code, I will stop and ask the
user to take the problem to Claude Code instead.

## Folder structure reference
- /spec/ — PROJECT_BRIEF.md, MASTER_SPEC.md, ARCHITECTURE.md
- /spec/slices/ — SLICE_N_NAME.md files (read the current slice
  before coding)
- /supabase/migrations/ — SQL migrations, ordered numerically
- /supabase/seed/ — seed scripts
- /src/app/ — Next.js App Router routes
- /src/components/ — React components grouped by feature area
- /src/lib/ — methodology, sync, schemas, utils, supabase clients
- /src/types/ — domain types
- /public/ — manifest, PWA icons, splash images

## Rules for every slice I generate

### 1. Stay within the allowlist
The slice document has a "Files to Create or Modify" section.
Touch nothing outside that list. If I think I need to change a file
outside the list, I stop and tell the user.

### 2. Never invent schema
If the slice touches the database, the prompt will include the
live schema (column names from the relevant migration files in
/supabase/migrations/). Use only the column names provided. Never
guess or invent names. If the prompt does not include a schema for
a data-layer slice, I stop and ask for it.

### 3. No placeholders, no TODOs
Every function I write is complete and working. I do not leave
comments like "// TODO: implement this later" or "# placeholder".
If I cannot complete something, I flag it clearly at the end of my
output rather than stubbing it.

### 4. List every assumption at the end
After every slice I finish, I list:
- Every column name I referenced (so the user can diff against the
  schema)
- Every env var I relied on
- Every external API endpoint I called
- Every Supabase RLS policy I assumed exists
- Every decision I made that was not explicit in the prompt

### 5. Stay within scope
The slice document has an "Acceptance Criteria" section. I build
only what those criteria require. I do not add features that are
not requested, even if they seem obvious or helpful.

### 6. Follow the architecture
I read /spec/ARCHITECTURE.md before writing code. Naming
conventions, folder structure, module boundaries, and key
dependencies come from there — not from my general preferences.
Specifically:
- src/lib/methodology/ is pure. Never import React, Supabase, or
  localStorage there.
- src/lib/sync/ may import Supabase and access localStorage. Never
  import React there.
- src/components/ may import from src/lib/. Never put business
  rules in components beyond simple display logic.
- src/app/ pages own data fetching; components own presentation.

### 7. TypeScript strict mode
TypeScript strict is on. Never widen types (any, as unknown as X)
to silence the compiler. If a type doesn't fit, I either fix the
underlying mismatch or flag it as a question for the user.

### 8. Forms, validation, and state
- Multi-field forms use React Hook Form + Zod. Single-field forms
  use plain useState.
- Zod schemas live in src/lib/schemas/ and are the single source
  of truth for both runtime validation and static types
  (z.infer<typeof Schema>).
- No external state libraries (no Redux, Zustand, Jotai, SWR, or
  TanStack Query). React's built-in state plus Supabase client is
  the stack.

### 9. Supabase access patterns
- Server components: import the server Supabase client from
  src/lib/supabase/server.ts.
- Client components: import the browser Supabase client from
  src/lib/supabase/client.ts.
- After a client mutation, call router.refresh() to re-fetch
  server data — do not maintain a parallel cache.
- Every user-scoped table query relies on RLS for scoping. Do not
  add explicit user_id filters in client code unless required by
  the query shape — RLS handles it.

### 10. Append-only tables
The set_logs and pr_history tables are append-only. Never generate
code that updates or deletes from these tables. Corrections happen
via new INSERT records, not UPDATE.

## Files I will never touch
- /spec/ (specifications, not code)
- CHANGELOG.md, DECISIONS.md, KNOWN_ISSUES.md (Claude Code
  maintains these)
- CLAUDE.md, AGENTS.md (project configuration, not my job to edit)
- .env, .env.local (secrets, never in generated code)
- pnpm-lock.yaml (auto-managed by pnpm install)

## Tone
Minimal explanation. Code first. Assumptions list at the end.
