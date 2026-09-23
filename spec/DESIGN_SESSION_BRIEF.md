# Training App — Design Session Brief (Claude Design × Marcus)

> **Purpose.** A working brief for a collaborative UX/UI design session: Marcus + Claude Design **brainstorm and design every tab of the app**, now that the backend and the base design system are **shipped and verified**. Design is informed by real, working capabilities — not a greenfield. Output feeds engineering, which wires designs to the existing data contract.
>
> **How to run this.** Marcus leads creative direction; Claude Design proposes, questions, and renders. Go tab by tab. Resolve the four **Open Decisions** (§5) early — they shape everything. Respect the **Wiring Contract** (§6): you may change any pixel, layout, IA, or flow, but not the data shapes underneath.

---

## 1. What the app is
A personal training PWA built around one lifter's (Marcus's) methodology — now expanding so followers can load and train his published plans (Push On / Playbook style). Two design drivers, non-negotiable: **friction is the enemy** on the daily surface (open → see today → log), and it must be **gym-legible** (glanceable at arm's length, sweaty hands, one thumb).

## 2. The backend is DONE (design against these real capabilities)
Shipped and verified end-to-end on the live app (2026-09-22):
- **Block + bank model.** A workout is ordered **blocks**; each block holds a **bank** of exercises; the lifter **picks one per session** (fresh choice, no memory).
- **Adjustable + flexible set-scheme (per block).** Warm-up sets + working sets. `working_sets` is a **soft target, not a cap**: after the target the logger offers **“＋ Add working set”** (W3, W4…) *and* **“Complete block”**; you can also finish **early** (Complete appears once ≥1 working set is logged — weak-day). Manual completion, never auto-locks. `to_failure` is an **optional per-set toggle**, not a set type.
- **Schedule-anchored nutrition.** Day-type (rest/lifting/cardio) drives a macro framework; macros tracked as **ranges vs target ranges** (under/in/over). **AI estimator**: photo capture OR text description → pre-fills macros. *(Planned: persist the photo + description with the meal — FUTURE_WORK #10.)*
- **Append-only PR history.** Weight PR + in-range-rep PR auto-detected on log; never edited/deleted.
- **Multiple plans**, an active plan drives Today/week/nutrition day-type. **Block II** is seeded content-faithfully.
- **Offline-first** logging with a sync queue; **PWA**, portrait, installed.

## 3. The design system is DONE (light + Satoshi mono)
Shipped tokens — evolve within this system, don't reinvent it:
- **Light theme**: white background `#FFFFFF`, near-black accent `#111113` (CTAs/active/PR), accent-foreground `#FAFAFA`, hairline borders `#E2E2E6`, recessed `#F5F5F6`, tiered grays for text. Tokens in `src/app/globals.css` `:root`; mapped in `tailwind.config.ts`.
- **Font**: **Satoshi** (Fontshare, loaded via `<link>` in `layout.tsx`); `font-sans`/`font-display` → Satoshi. Mono numerals via `tabular-nums`.
- **Semantic colors** (bright, consistent tone): success `#22C55E` · warning `#EAB308` (bright yellow) · danger `#DC2626` · cardio `#14B8A6` (bright teal). Used for macro ranges, PR/status badges, cardio.
- **Radius** 8px; uppercase letter-spaced micro-labels; hairline-defined cards.
- **Live design harness** to see/iterate the system: `/demo` (dev-only, `pnpm dev` → `localhost:3111/demo`). Design checkpoint: git tag `reskin-demo-checkpoint`.
- Primitives: shadcn/Radix (`src/components/ui/*`) — Button, Card, Input, Checkbox, Select, Tabs, Dialog, Sheet, Popover, Command, Form; plus badges, macro bars, bottom tab bar, sync indicator.

## 4. Scope — design EVERY tab, informed by the backend
Current bottom nav (shipped): **Today · Plan · Library · Fuel (Nutrition) · Progress · Trends** + a Settings gear. Design each, plus the **Logger** (the flagship hot path) and the **new Community** surfaces:
- **Today** — day + sessions; the fast path to Start Workout; nutrition day summary.
- **Logger** — flagship. Block progress, exercise picker (bank), set entry (warm-up + working + add-set + complete), inline PR moments, trustworthy offline/sync indicator. **This is where speed matters most.**
- **Plan** — active plan, the week, plan switcher, day editor.
- **Library** — **the authoring surface** Marcus specifically wants redesigned: **add exercises, create/edit blocks, create/edit programs**, cardio/recovery. Today it nests 5 deep (Lifting · Workouts · Exercises · Cardio · Recovery) — flatten it.
- **Fuel / Nutrition** — day framework, macro range-vs-range bars, meal log, the AI photo/description estimator flow.
- **Progress / History** — PR timeline, completed workouts, per-exercise progression (charts).
- **Trends** — analytics.
- **Settings / Profile** — goal mode, targets, account.
- **Community (new — Creator-Program / Push On)** — see §5.3.

## 5. Open Decisions to brainstorm FIRST (they shape the IA)
1. **Mobile = viewer/logger, desktop = builder?** Marcus's leaning: **mobile is the clean, simple daily interface** (see today, log, view plan, log food) — and the heavy **plan-authoring (Library: add exercises, create blocks, create/edit programs) lives on the desktop/wide version**. Decide: is authoring mobile-hidden (desktop-only), mobile-lite, or full-parity? This is the biggest lever for a clean mobile app. Design the responsive split around the answer.
2. **Cut tabs / decrease functionality.** The 6-tab bar is dense and Library nests deeply. Marcus wants to **cut some tabs/windows and reduce functionality** to a simpler core. Propose a leaner IA — which tabs merge (e.g. Progress + Trends? History into Progress?), which authoring moves off mobile, what the minimal daily tab set is. Core lifter hot path (Today → Start → Log) must stay fastest.
3. **Community / Creator-Program (Push On-like).** Design the creator + follower experience: **publish a plan** (title/description/cover/price → public loadable template; the `plan_templates` table already anticipates this), a **creator storefront** (browse Marcus's programs → subscribe), **subscribe → load plan** into the follower's own app (they reuse Today/Logger/Nutrition scoped to it), and a **lightweight community feed** (share a completed session / PR / note; react/support). Login resolves **creator vs follower shell**; a follower only ever sees their own world + the public feed. **No coach→client CRM** (that model was rejected — 1-to-many self-serve only). Where does this live in the IA?
4. **Monetization.** Subscription (free tier + paid, ~$15/mo). Design the paywall/subscribe UI so it wires to **Stripe or free-access-first** — don't assume payments are built.

## 6. The Wiring Contract — do NOT break (design freely on top of it)
Change any presentation; keep the data shapes so re-integration is mechanical:
- **Append-only**: `set_logs`, `pr_history` are INSERT/SELECT only — never design an "edit set" / "delete PR" affordance (log a correction as a new entry instead).
- Storage stays `weight_kg` (show lbs). Field names map 1:1 to DB columns; enums fixed: `block_type` (failure/mobility/corrective — note: "failure" now means "structured set-scheme block", the actual to-failure flag is the separate `to_failure` column), `session_type`, `timing`, `pr_type`, `goal_mode`, day-of-week.
- Scheme columns (migration 025): `blocks.warmup_sets/working_sets/to_failure`.
- Server-first data flow (pages fetch → thin client components); no new global client store. Mutations/projections live in `src/lib/{plan,nutrition,library,methodology}/*` — see `spec/REDESIGN_BRIEF.md` §9 for exact signatures.

## 7. Design goals (the rubric — judge every choice against these)
Gym-legible · fast data entry (minimize taps, prominent tabular numbers) · serious-not-influencer (methodology tool, not gamified) · calm hierarchy (the eye lands on today's work / the next set / whether macros are in range) · trustworthy with data (offline sync always legible; once followers exist, their data feels private).

## 8. Deliverables of the session
- The resolved **Open Decisions** (§5) with rationale.
- A proposed **IA / navigation** (leaner tab set + the mobile-vs-desktop split + where Community lives).
- **Per-tab designs** (default / empty / loading / error where relevant), mobile-first, with the Logger as the flagship and the macro range-vs-range made instantly readable.
- The **Community** creator + follower flows.
- Notes mapping new components back to `src/components/<area>/*` and the wiring contract, so engineering can build it.

---
*Reference: full original brief at `spec/REDESIGN_BRIEF.md` (§0 update + §8-REVISED are current; §3 IA + §4 screen inventory + §6 primitives + §9 wiring contract are still authoritative). Backend build record: `build-log.md`, `DECISIONS.md` (D1–D16), `FUTURE_WORK.md`.*
