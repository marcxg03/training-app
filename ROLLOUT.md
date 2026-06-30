# Rollout Guide — Instrument redesign

How to take the `redesign/instrument` branch live for real users. Read
`KNOWN_ISSUES.md` (the redesign section) alongside this.

## What's in scope for rollout

- ✅ **The full athlete app** (Today, Logger, Plan, Fuel/Nutrition, Library, Progress,
  Settings, Auth, Offline) — real Supabase backend, redesigned UI, live-tested.
- 🚫 **Coaching** — UI-only on mock data, **no backend**. Gated OFF by default and must
  stay off for real users (see below).

## Prerequisites

- A Supabase project with **all migrations applied** (`supabase/migrations/`), RLS
  enabled (it is, per migrations), and at least one authenticated user/profile.
- Node 20+/22+, `pnpm` (see `pnpm-lock.yaml`). Build verified on Node 24.
- A host that runs Next.js (Vercel is the natural fit).

## Environment variables

Set these on the host (and in `.env.local` for local runs). Keys-only template lives
in `.env.example`.

| Variable                        | Required        | Notes                                                                                                                             |
| ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅              | Supabase project URL (client-safe)                                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅              | Supabase anon key (client-safe)                                                                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | ⚠️ server-only  | Used only by the seed script — never expose to the client                                                                         |
| `ANTHROPIC_API_KEY`             | optional        | Enables the AI photo macro estimator; if unset, that button is hidden and macros are entered manually                             |
| `NEXT_PUBLIC_COACHING_ENABLED`  | **leave unset** | Coaching feature flag. Must NOT be `true` for real users — coaching has no backend. Set `true` only to preview the mock UI in dev |
| `SEED_TARGET_USER_ID`           | optional        | Seed script target when multiple profiles exist                                                                                   |

## Build & deploy

```bash
pnpm install --frozen-lockfile
pnpm build            # production build (Next.js)
pnpm start            # or deploy the build to your host
```

On Vercel: connect the repo, set the env vars above (omit `NEXT_PUBLIC_COACHING_ENABLED`),
and deploy the `redesign/instrument` branch (or merge to `main` first).

## The correctness gate (ralph-verify)

Run the project's gate before any deploy; it must be GREEN:

```bash
./scripts/ralph-verify.sh        # format:check → typecheck → lint → build
```

## Pre-flight checklist (go / no-go)

- [ ] `./scripts/ralph-verify.sh` is **GREEN**.
- [ ] Env vars set on the host; `NEXT_PUBLIC_COACHING_ENABLED` is **unset/false**.
- [ ] Confirm `/coach` redirects to `/today` in the deployed build (coaching hidden).
- [ ] Sign in via magic link works against the production Supabase project.
- [ ] Smoke-test the hot path on a real device: Today → Start Workout → log a set
      (PR detection + sync) → End → Summary; then check Progress.
- [ ] Log a meal (and AI estimate if `ANTHROPIC_API_KEY` is set); set nutrition targets.
- [ ] Build a block/workout in the Library and assign it to a plan day.
- [ ] PWA installs and launches standalone; offline screen + queued-sync behave.
- [ ] Review `KNOWN_ISSUES.md` — accept the documented limitations.

## Verification already done

- Static gate GREEN (format/typecheck/lint/production build) at every phase + final.
- **Security review:** no critical/medium findings. New history queries are RLS-scoped
  and IDOR-safe (a foreign `exercise_id`/`completion_id` returns zero rows → graceful
  empty state). Auth, the estimate-macros API, and the service worker are unchanged.
- **Correctness review:** no code blockers; typecheck-validated queries against the
  live schema.
- **Live browser stress test** (real Supabase, real session): Today, Fuel, Plan,
  Progress, and the **full logger flow** (bank resolve → steppers → log → weight+rep PR
  detection → optimistic sync → end-confirm → summary) all verified. Coaching gate
  confirmed (redirects, static persona pill). Zero redesign defects found.

## Known limitations at rollout (see KNOWN_ISSUES.md)

- 🔴 **Coaching is not functional** — UI-only on mock data; gated off. Do not enable for
  real users until the backend slice (Codex) lands.
- 🟢 A couple of exercises have placeholder seed `notes` (e.g. "Compound Compound")
  visible in the exercise picker — data cleanup, not a code issue.

## Next backend slice (coaching) — for Codex

To make coaching real, work in this repo on a new branch:

- Replace the mock getters in `src/lib/coach/mock.ts` with Supabase-backed queries
  (keep the same function names/return types so the UI is untouched).
- Add migrations for `coach_clients`, `coach_notes`, and client assignments, with RLS
  that lets a coach read their clients' data (the cross-user policy is the careful part)
  — follow the migration-immutability rule in `CLAUDE.md`.
- Wire the form handlers in `src/app/(app)/coach/**` + `src/components/coach/**` to real
  mutations, add a real persona/role model, then flip `NEXT_PUBLIC_COACHING_ENABLED`.

## Rollback

- The redesign lives on `redesign/instrument`; `main` is untouched. To roll back, deploy
  `main`. After merge, revert with `git revert` (never reset shared history), per
  `CLAUDE.md`.
