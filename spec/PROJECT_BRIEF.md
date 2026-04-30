# PROJECT_BRIEF.md

## Project Name
training-app

## Problem Statement
Marcus's training methodology — block + bank programming, schedule-anchored
nutrition with full macro tracking, ATG + traditional split, 1 warm-up + 2
working sets to failure — currently lives across six markdown files in a
personal wiki. There is no clean way to view today's session before or
during a workout, log sets in real time with PR detection, track macros
against day-type target ranges, or evolve the plan as it changes. PR
tracking is manual and scattered. Nutrition guidance lacks a daily
reference. Plan edits require markdown editing.

This app is a UI that encompasses the entire training methodology — every
methodology concept (Block, Bank, day-type, prescribed range, in-range PR)
is a first-class entity in the data model and is visible in the interface,
not buried in config or code.

## Target User
- **MVP user**: Marcus only. Personal-first build. Single-user UX.
- **Architecture posture**: community-ready. User-scoped data with Supabase
  RLS active from day one. Plan stored as data, not hardcoded. No
  follower-facing UI in MVP, but no schema restructuring required to add
  it in Phase 4.
- Technical level: app developer. No simplification needed for non-
  technical users in MVP.

## Definition of Done (MVP)
The MVP is complete when Marcus can do all of the following without
touching markdown or a spreadsheet:

1. Open the app on iPhone (PWA installed to home screen) and see today's
   sessions (lifting + cardio + recovery) in chronological order, plus
   today's macro progress against target ranges.
2. Tap into a lifting session and work through every block with the
   WU + W1 + W2 protocol — or the mobility/corrective variant on ATG and
   corrective blocks, which skips the failure flag.
3. Pick exercises fresh from each block's bank every session — no default,
   no memory of previous sessions, full freedom.
4. Have PRs auto-detected and flagged in real time on W1 and W2 writes:
   Type A (Weight PR / "the ladder") and Type B (In-Range Rep PR, where
   "in range" is the prescribed rep range pinned to the SetLog at write
   time).
5. Mark cardio sessions done with one tap.
6. Log meals with protein/carbs/fat in grams; calories auto-derived
   (P×4 + C×4 + F×9). Daily totals roll up against four target ranges
   (calories, protein, carbs, fat).
7. View PR history per exercise organized by muscle group, with a chart
   showing the weight ladder over time.
8. Edit the plan structure (sessions per day, block order per session)
   and exercise banks (add/remove exercises per block, edit per-exercise
   notes that propagate everywhere) in-app.
9. Choose a goal mode (Cut / Maintain / Lean Bulk) that pre-populates
   macro target defaults and shapes the day-type meal framework.
10. Set bodyweight and height as profile fields, editable anytime.
11. Resume an abandoned workout if the app closes mid-session.
12. All data is user-scoped under Marcus's account, stored in Supabase
    with RLS active.

## Tech Stack (locked in Phase 0)
- **Frontend**: Next.js 15 (App Router) + TypeScript (strict) + Tailwind
  CSS. Mobile-first PWA via @ducanh2912/next-pwa, installed to iOS home
  screen for fullscreen, app-like experience.
- **UI primitives**: shadcn/ui (themed dark, lilac accent), Lucide icons.
- **Backend**: Supabase (Postgres + Auth + RLS). One Supabase project
  scoped to this app.
- **Auth**: Supabase magic link (email-based, no password). Single user
  in MVP; multi-user ready.
- **Deployment**: Vercel (hobby tier).
- **State**: React built-in (useState, useReducer, Context). No external
  state library.
- **Forms**: React Hook Form + Zod for any form with multiple validated
  fields (Log Meal, Nutrition Targets, Plan Editor, Profile). Single-
  field forms use plain useState.
- **Charts**: Recharts. Used only for the PR ladder chart in MVP.
- **Sync model**: queue-on-failure. Writes go directly to Supabase; on
  network failure, SetLog records queue in localStorage and retry on
  reconnect. Last-write-wins (Marcus is the only writer).
- **Tooling**: pnpm, Node 20 LTS, ESLint + Prettier, date-fns for date
  handling.

## Design System
- Pure black background (#000000), white text (#ffffff), lilac accent
  (#9b7fd4 range) for active states, PR stars, primary CTAs, progress
  bar fills, selected nav tab.
- Standard semantic colors for status (red over-range, green in-range,
  amber soft-rule warnings) tuned for dark-mode contrast.
- Inter typeface with tabular numerals enabled for any column-aligned
  numeric display (set logger, macro tracker, PR history).
- Touch targets minimum 44px (iOS HIG).

## Hard Constraints
- **Platform**: iOS Safari PWA is the primary surface. Desktop browser
  is secondary. No Android requirement.
- **Budget**: $0 ongoing. Supabase free tier and Vercel hobby tier are
  sufficient for single-user use indefinitely.
- **No external API integrations in MVP**. Claude API integration is
  deferred to Phase 3 (natural language set logging).
- **No push notifications** at any phase.
- **No deadline**. Ship-when-ready.

## Out of Scope (MVP)
- Progress charts beyond the basic PR ladder
- Bodyweight or body-fat history tracking (profile fields only — single
  current values, manually updated)
- Plan versioning, export, or shareable summaries
- Natural language set logging
- Community features: plan templates, follower onboarding, shared PR
  feeds, template loading
- Android app
- Push notifications
- Onboarding flows for new users
- Multi-user UI (architecture supports it; UI does not surface it)

## Existing Assets
- Wiki source files (complete, ready to seed the database):
  overview.md, master-plan.md, current-plan.md, training-log.md,
  nutrition.md, plan-decisions.md. These will be pasted into Claude
  Code at the start of the migration slice (Slice 2) as the source for
  the seed script — no separate ETL, no intermediate format.
- GitHub account: marcxg03. Repo for this app: created at
  github.com/marcxg03/training-app.
- Supabase account: exists. Project for this app: created in an early
  build slice (Slice 1).
- Vercel account: exists. Project for this app: created during the
  deployment slice.
- Dev environment: ready (Mac, VS Code, Node 20, Claude Code, Codex
  desktop, zsh).

## Open Questions
None. All Phase 0 / Phase 1 questions resolved before MASTER_SPEC was
locked.
