# training-app

A mobile-first PWA that runs my full training methodology end-to-end — block + bank lifting programming, schedule-anchored nutrition, append-only PR history, and a hand-rolled analytics layer. Built with Next.js App Router and Supabase, deployed on Vercel.

## What it does

- **Block + bank lifting** — training blocks with a "bank" of exercises; the plan view serves the day's session, and every set is logged against it.
- **Append-only PR history** — set logs are never mutated; PRs are detected from the log stream, so history is auditable by construction.
- **Schedule-anchored nutrition** — daily calorie/protein targets that follow the training schedule; meal logging with a photo → AI macro estimation flow (Claude vision, server-side only, hidden when no API key is configured).
- **Trends analytics** — a dedicated `/trends` hub: per-exercise e1RM progression (Epley), weekly volume + tonnage by muscle group, 30-day nutrition bands vs targets, and bodyweight trend with one-tap quick-log. All charts are hand-rolled SVG — no chart library.
- **PWA** — installable, offline shell, bottom-nav app shell designed for phone-first use in the gym.

## Stack

| Layer     | Choice                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Framework | Next.js (App Router, RSC-first) + TypeScript                                   |
| Data/Auth | Supabase (Postgres, per-user RLS on every table, SSR auth via `@supabase/ssr`) |
| UI        | Tailwind + shadcn (New York), mobile-first, semantic tokens                    |
| Forms     | react-hook-form + zod                                                          |
| AI        | Anthropic SDK — meal-photo macro estimation                                    |
| Testing   | Playwright e2e + screenshot verification, fixture-asserted projections         |
| Deploy    | Vercel                                                                         |

## Architecture conventions

- Reads live in `src/lib/<domain>/queries.ts`, writes in `mutations.ts` (server actions), pure transforms in `projections.ts` — pages are RSC by default.
- Units are stored metric, displayed imperial (`src/lib/units`); day bucketing uses a single app-timezone clock (`src/lib/time`).
- Database changes ship as numbered migrations (`supabase/migrations/`) with per-user RLS as the default posture.
- Personal data never ships with the repo: the seed pipeline (`pnpm seed`) reads a local wiki export that stays untracked.

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase project values
pnpm dev
```

`pnpm typecheck`, `pnpm lint`, and the Playwright suites in `e2e/` are the verification gates; every feature slice lands with screenshots at mobile (390px) and desktop widths.
