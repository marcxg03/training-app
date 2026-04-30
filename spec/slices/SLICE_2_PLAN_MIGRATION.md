# SLICE_2_PLAN_MIGRATION.md

## 1. Goal
Apply migrations 002 (plan structure), 005 (nutrition), and 006 (plan
templates) to Supabase. Build a TypeScript seed script that reads six
wiki markdown files and writes the complete training plan, exercise
banks, per-exercise notes and rep ranges, day-type meal framework,
nutrition target ranges, and three historical PRs into the database.
Render a read-only Plan tab (Screens 2A and 2B) showing the seeded
data.

## 2. Acceptance Criteria

1. Migrations 002, 005, 006 apply cleanly via `supabase db push` with
   no errors.
2. Generated TypeScript types in `src/lib/supabase/types.ts` reflect
   the full new schema after `supabase gen types typescript --linked`.
3. The seed script reads all six wiki markdown files from
   `supabase/seed/wiki/` and writes a complete plan to the database
   in a single run, scoped to Marcus's user_id.
4. After seeding, the database contains:
   - 1 row in `training_plans` (`name='Marcus base plan v1'`,
     `is_active=true`)
   - 7 rows in `daily_schedules` (one per day_of_week, Sunday marked
     `is_rest_day=true`)
   - The exact session count per day specified in `current-plan.md`
     (Monday 2 sessions, Tuesday 1, Wednesday 1, Thursday 1, Friday
     2, Saturday 2, Sunday 0)
   - All blocks per session (e.g., Monday Upper has 8 blocks; Lower
     ATG has 10 blocks; Thursday Push has 7 blocks including the
     second Lateral Raise block)
   - All exercises in `exercises` (deduplicated globally — same
     exercise referenced from multiple blocks shares one row)
   - All `block_exercises` join rows wiring exercises to blocks
   - 1 row in `nutrition_targets` with the locked ranges from
     `nutrition.md`
   - 1 row in `plan_templates` (Marcus's plan snapshot, `is_public=
     false`)
   - 3 rows in `pr_history` (Bench 235×1, OHP 185×3, Deadlift 435×1,
     all `pr_type='weight'`)
5. RLS policies are present on every new table per migration 007's
   pattern (SELECT, INSERT, UPDATE, plus DELETE on tables that aren't
   append-only). Append-only tables (`pr_history`) get only SELECT
   and INSERT.
6. Re-running the seed script with the same wiki content is
   idempotent — no duplicate rows, no errors. The script either
   detects existing seeded data and exits cleanly, or upserts on
   stable identity keys (block name + session_id, exercise name +
   user_id, etc.).
7. Re-running the seed script after editing a wiki file updates the
   relevant rows without breaking referential integrity.
8. Every chest exercise (Upper, Mid, Lower across Monday and
   Thursday) has `is_compound=true` and `prescribed_min=6`,
   `prescribed_max=8`.
9. Every isolation exercise (per `Type` column in `current-plan.md`)
   has `is_compound=false` and `prescribed_min=8`, `prescribed_max=
   10`.
10. ATG, mobility, and corrective exercises (Saturday Lower ATG
    blocks 1–8: ATG Split Squat, Jefferson Curl, Seated Good Mornings,
    Tib Raises, Low Back Extensions, Seated Leg Extension, Seated
    Hamstring Curl, ATG Calf Raises) are stored as exercises but
    their blocks have `block_type='mobility'` (not `'failure'`).
    All other lifting blocks have `block_type='failure'`.
11. Every exercise in `Block 4 — Area of Focus — Back` (Friday Pull)
    has `muscle_groups` populated with both high-level (`'back'`) and
    granular tags (e.g., `'lats'`, `'teres_major'`, `'upper_back'`,
    `'rear_delts'`). Verified via direct query: `SELECT name,
    muscle_groups FROM exercises WHERE name = 'Cable Pullover'`
    returns `['back', 'lats', 'teres_major']` or similar.
12. Cardio sessions are seeded with structured fields:
    - Monday Speed Run: `cardio_format='speed_run'`,
      `cardio_distance='5×100m'`, `cardio_target_zone='sprint'`,
      `description` carries the warm-up + plyos + sprint detail
    - Saturday Endurance Run: `cardio_format='endurance_run'`,
      `cardio_distance='3 miles'`, `cardio_target_zone='zone_2'`
    - Wednesday and Friday Basketball: `cardio_format='basketball'`,
      `cardio_distance=null`, `cardio_target_zone='game_pace'`
13. Recovery sessions (Thursday Sauna, Saturday Hot Yoga or Sauna,
    Sunday Hot Yoga or Sauna) are seeded with `session_type=
    'recovery'`, structured cardio fields null, `description`
    carrying the recovery activity detail.
14. The Plan tab Screen 2A renders all 7 days as cards in week order
    (Mon → Sun). Each card shows: day name, all sessions in
    chronological order (using `sessions.timing` and
    `sessions.display_order`), session names, gym (where set), and a
    brief description line per session.
15. Tapping any day card navigates to Screen 2B for that day,
    rendering all sessions in detail. Lifting sessions show their
    block list with block names; tapping a block reveals its full
    exercise bank (read-only). Cardio and recovery sessions show
    their description.
16. Plan tab is fully read-only — no edit affordances visible.
17. The bottom tab bar still works correctly across all five tabs
    (no regressions from Slice 1).
18. `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` all pass.
19. Three Type A PRs visible in the database (`pr_history` table)
    matching the wiki: Bench 235×1, OHP 185×3, Deadlift 435×1.
    `set_log_id` on these three rows is null (they predate any
    SetLog).
20. The wiki source files copied into `supabase/seed/wiki/` are
    gitignored — they're external content, not code, and shouldn't
    be tracked in the repo.

## 3. Files to Create or Modify

### New SQL migrations
- `supabase/migrations/002_plan_structure.sql`
- `supabase/migrations/005_nutrition.sql`
- `supabase/migrations/006_plan_templates.sql`
- `supabase/migrations/007_rls_policies.sql` — modified to add
  policies for all new tables; existing profiles policies preserved

### New seed-related files
- `supabase/seed/wiki/` — folder for the six source markdown files
  (gitignored)
  - `overview.md`
  - `master-plan.md`
  - `current-plan.md`
  - `training-log.md`
  - `nutrition.md`
  - `plan-decisions.md`
- `supabase/seed/wiki/.gitkeep` — empty file so the folder structure
  is preserved in the repo (the actual .md files are gitignored)
- `supabase/seed/seed-from-wiki.ts` — the seed script
- `supabase/seed/lib/parser.ts` — markdown parser utilities
  (table extraction, heading extraction, key-value extraction)
- `supabase/seed/lib/methodology-rules.ts` — domain-specific
  parsing logic that translates wiki structure into DB rows
- `supabase/seed/lib/supabase-admin.ts` — server-side Supabase
  client using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for the
  seed run)
- `supabase/seed/lib/types.ts` — TypeScript types for parsed
  wiki structures (intermediate representation between markdown
  and DB rows)

### New seed runtime support in package.json
- `package.json` — add `"seed": "tsx supabase/seed/seed-from-wiki.ts"`
  script and `tsx` and `gray-matter` to dependencies (dev:
  `@types/node`, already present)

### New routes — Plan tab
- `src/app/(app)/plan/page.tsx` — replace Slice 1 placeholder.
  Server component fetches the active plan + schedules + sessions
  for all 7 days. Renders 7 `<DayCard />` components.
- `src/app/(app)/plan/[day]/page.tsx` — Screen 2B. Server component
  fetches detailed session data for the requested day, including
  blocks and bank exercises. Renders all sessions chronologically.

### New components
- `src/components/plan/DayCard.tsx` — server component. Renders one
  day's worth of session info in a compact card.
- `src/components/plan/SessionSummaryRow.tsx` — server component.
  One row per session inside DayCard.
- `src/components/plan/SessionDetailPanel.tsx` — server component.
  One panel per session on Screen 2B.
- `src/components/plan/BlockList.tsx` — client component (only
  client because of expand/collapse interaction). Renders the
  ordered list of blocks for a lifting session, each expandable to
  show its exercise bank.
- `src/components/plan/ExerciseBankList.tsx` — server component.
  Renders the exercises in a block's bank with their muscle group
  captions.

### New `.gitignore` modification
- `.gitignore` — add an entry to ignore the wiki content files in
  `supabase/seed/wiki/*.md` (but NOT the folder itself or the
  `.gitkeep`)

### New library modules (per ARCHITECTURE.md module boundaries)
- `src/lib/methodology/muscle-groups.ts` — pure helper that takes
  an array of `muscle_groups` tags and returns the high-level
  taxonomy tag (Chest / Shoulders / Back / Arms / Legs / Core /
  Calves). Used by Slice 6's PR Tracker, but the helper is created
  here because the seeding logic uses it for sanity-checking that
  every exercise has at least one high-level tag.
- `src/lib/utils/wiki-paths.ts` — small constant module exporting
  the relative paths to each expected wiki file. Used by the seed
  script.

### Modify (existing files)
- `src/lib/supabase/types.ts` — regenerated after migrations apply
- `CHANGELOG.md`, `DECISIONS.md`, `KNOWN_ISSUES.md` — updated by
  Claude Code in the post-slice sequence

### Item A from Slice 1 — env-getter consolidation
- `src/lib/supabase/env.ts` — NEW. The fourth Supabase file
  threshold has been crossed by `supabase/seed/lib/supabase-admin.ts`,
  which is also a Supabase client. Per the deferred decision in
  Slice 1, extract the duplicated env-var getters from `client.ts`,
  `server.ts`, `middleware.ts`, and the new `supabase-admin.ts`
  into one shared module. This is in scope for Slice 2.
- Modify `src/lib/supabase/client.ts`, `server.ts`,
  `middleware.ts` to import from `env.ts` instead of defining
  getters locally.

## 4. Component / Function Contracts

### Migration 002 — plan structure

```sql
CREATE TYPE day_of_week_enum AS ENUM (
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
);

CREATE TYPE session_type_enum AS ENUM (
  'lifting', 'cardio', 'recovery'
);

CREATE TYPE timing_enum AS ENUM ('am', 'pm', 'anytime');

CREATE TYPE block_type_enum AS ENUM (
  'failure', 'mobility', 'corrective'
);

CREATE TYPE cardio_format_enum AS ENUM (
  'speed_run', 'endurance_run', 'basketball'
);

CREATE TYPE cardio_target_zone_enum AS ENUM (
  'sprint', 'zone_2', 'anaerobic', 'game_pace'
);

CREATE TABLE training_plans (
  plan_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_plans_user
  ON training_plans (user_id, is_active);

CREATE TABLE daily_schedules (
  schedule_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES training_plans(plan_id)
                 ON DELETE CASCADE,
  day_of_week  day_of_week_enum NOT NULL,
  is_rest_day  boolean NOT NULL DEFAULT false,
  UNIQUE (plan_id, day_of_week)
);

CREATE TABLE sessions (
  session_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        uuid NOT NULL REFERENCES daily_schedules(schedule_id)
                       ON DELETE CASCADE,
  session_type       session_type_enum NOT NULL,
  session_name       text NOT NULL,
  timing             timing_enum NOT NULL DEFAULT 'anytime',
  gym                text,
  description        text,
  display_order      integer NOT NULL,
  cardio_format      cardio_format_enum,
  cardio_distance    text,
  cardio_target_zone cardio_target_zone_enum,
  CHECK (
    -- Cardio fields only set when session_type = 'cardio'
    (session_type = 'cardio' AND cardio_format IS NOT NULL)
    OR
    (session_type != 'cardio' AND cardio_format IS NULL
     AND cardio_distance IS NULL AND cardio_target_zone IS NULL)
  )
);

CREATE INDEX idx_sessions_schedule
  ON sessions (schedule_id, display_order);

CREATE TABLE blocks (
  block_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(session_id)
                  ON DELETE CASCADE,
  block_name    text NOT NULL,
  block_type    block_type_enum NOT NULL DEFAULT 'failure',
  display_order integer NOT NULL
);

CREATE INDEX idx_blocks_session
  ON blocks (session_id, display_order);

CREATE TABLE exercises (
  exercise_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  name           text NOT NULL,
  notes          text NOT NULL DEFAULT '',
  prescribed_min integer NOT NULL,
  prescribed_max integer NOT NULL,
  muscle_groups  text[] NOT NULL DEFAULT '{}',
  is_compound    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name),
  CHECK (prescribed_min > 0 AND prescribed_max >= prescribed_min)
);

CREATE INDEX idx_exercises_user
  ON exercises (user_id);

CREATE INDEX idx_exercises_muscle_groups
  ON exercises USING GIN (muscle_groups);

CREATE TRIGGER exercises_set_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE block_exercises (
  block_id    uuid NOT NULL REFERENCES blocks(block_id)
                ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(exercise_id)
                ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, exercise_id)
);

CREATE INDEX idx_block_exercises_block
  ON block_exercises (block_id, display_order);
```

### Migration 005 — nutrition

```sql
CREATE TABLE nutrition_targets (
  target_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  cal_min        integer NOT NULL,
  cal_max        integer NOT NULL,
  protein_min_g  integer NOT NULL,
  protein_max_g  integer NOT NULL,
  carbs_min_g    integer NOT NULL,
  carbs_max_g    integer NOT NULL,
  fat_min_g      integer NOT NULL,
  fat_max_g      integer NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (cal_min < cal_max),
  CHECK (protein_min_g < protein_max_g),
  CHECK (carbs_min_g < carbs_max_g),
  CHECK (fat_min_g < fat_max_g)
);

CREATE TRIGGER nutrition_targets_set_updated_at
  BEFORE UPDATE ON nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE meal_entries (
  meal_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  meal_type  text NOT NULL,
  protein_g  numeric NOT NULL,
  carbs_g    numeric NOT NULL,
  fat_g      numeric NOT NULL,
  calories   numeric NOT NULL,
  note       text,
  logged_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0)
);

CREATE INDEX idx_meal_entries_user_date
  ON meal_entries (user_id, date);
```

### Migration 006 — plan templates and PR history shell

Note: `pr_history` is normally a Slice 4 concern, but seeding three
historical PRs requires the table to exist now. Migration 006 creates
both `plan_templates` and `pr_history` since both relate to forward-
compatibility/seeding rather than the live workout flow.

```sql
CREATE TABLE plan_templates (
  template_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  version        integer NOT NULL,
  is_public      boolean NOT NULL DEFAULT false,
  snapshot_json  jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, version)
);

CREATE TYPE pr_type_enum AS ENUM ('weight', 'in_range_rep');

CREATE TABLE pr_history (
  pr_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id)
                 ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(exercise_id)
                 ON DELETE CASCADE,
  set_log_id   uuid,  -- nullable; null for seeded historical PRs
  pr_type      pr_type_enum NOT NULL,
  weight_kg    numeric NOT NULL,
  reps         integer NOT NULL,
  achieved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_history_user_exercise
  ON pr_history (user_id, exercise_id, weight_kg DESC, reps DESC);

CREATE INDEX idx_pr_history_user_type
  ON pr_history (user_id, pr_type);
```

### Migration 007 — RLS policies (extended)

The existing profiles policies stay. Add policies for every table
created in migrations 002, 005, 006:

```sql
-- training_plans, daily_schedules (by plan_id chain), sessions
-- (by schedule_id chain), blocks, exercises, block_exercises,
-- nutrition_targets, meal_entries: SELECT, INSERT, UPDATE, DELETE
-- via auth.uid() = user_id (or via the foreign-key chain for
-- daily_schedules, sessions, blocks, block_exercises which don't
-- have a direct user_id).
--
-- pr_history: SELECT and INSERT only. No UPDATE. No DELETE. Append-
-- only enforced at the DB layer.
--
-- plan_templates: SELECT, INSERT, UPDATE, DELETE all gated by
-- auth.uid() = owner_user_id. Phase 4 will broaden SELECT to allow
-- public templates; for now, owner-only.
```

The exact policy SQL is straightforward but verbose; Codex generates
it following the pattern. For tables without direct `user_id`
(daily_schedules, sessions, blocks, block_exercises), the policy
joins through the FK chain to verify ownership:

```sql
CREATE POLICY "select_own" ON daily_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_plans p
      WHERE p.plan_id = daily_schedules.plan_id
      AND p.user_id = auth.uid()
    )
  );
-- (same pattern for INSERT, UPDATE, DELETE)
```

### Seed script — seed-from-wiki.ts

```ts
// supabase/seed/seed-from-wiki.ts
//
// Run via `pnpm seed`.
// Reads six markdown files from supabase/seed/wiki/.
// Writes the full plan to Supabase using the service role key.
// Idempotent — safe to run multiple times.

import { createSupabaseAdminClient } from './lib/supabase-admin';
import { parsePlanFromWiki } from './lib/methodology-rules';
import { wikiPaths } from './lib/wiki-paths';
import * as fs from 'fs/promises';

async function main() {
  // 1. Verify env vars present
  // 2. Read all six wiki files; abort with clear error if any
  //    is missing (developer should have copied them in)
  // 3. Identify the user_id to seed against. In MVP this is
  //    Marcus's account — read from an env var
  //    SEED_TARGET_USER_ID, OR look up the single profile row
  //    in the database.
  // 4. Parse each wiki file into structured intermediate data
  //    (TrainingPlanSpec).
  // 5. Apply schedule validation: hard rules from MASTER_SPEC
  //    Section 8. If hard rules violated, abort with a
  //    descriptive error.
  // 6. Open a transaction (via PostgREST RPC or direct PG
  //    connection — implementation detail decided at slice time).
  // 7. Upsert training_plans (find by user_id + is_active=true,
  //    or insert).
  // 8. Upsert daily_schedules per day_of_week.
  // 9. Upsert sessions per (schedule_id, session_name).
  // 10. Upsert blocks per (session_id, block_name, display_order).
  // 11. Upsert exercises per (user_id, name) — globally
  //     deduplicated.
  // 12. Wire block_exercises (delete + reinsert per block to
  //     handle exercise removals from a block's bank cleanly).
  // 13. Upsert nutrition_targets per user_id (single row).
  // 14. Insert plan_templates row with the JSON snapshot of the
  //     full parsed plan (version auto-incremented from prior).
  // 15. Insert the three historical PRs into pr_history if not
  //     already present (idempotency check on
  //     user_id + exercise_id + weight_kg + reps).
  // 16. Print a summary: rows inserted, rows updated, exercises
  //     deduplicated, validation warnings (soft rules, if any).
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

### Parser module — lib/parser.ts

Pure markdown utilities, no domain knowledge:

```ts
// Extract markdown tables. Returns an array of rows, each row is
// an array of cell strings.
export function extractTables(md: string): MarkdownTable[];

// Extract sections delimited by H2 or H3 headings.
export function extractSections(md: string, level: 2 | 3):
  Map;

// Parse a "key: value" or "**Key:** value" line into a tuple.
export function parseKeyValue(line: string):
  { key: string; value: string } | null;

// Strip markdown emphasis (**bold**, _italic_, `code`) for
// matching exercise names against existing entries.
export function normalizeExerciseName(raw: string): string;
```

### Methodology-rules module — lib/methodology-rules.ts

Domain knowledge that translates wiki structure into typed plan data.
Each function is named for the wiki section it parses:

```ts
export function parseWeeklySchedule(currentPlanMd: string):
  ParsedWeeklySchedule;

export function parseSessionBlocks(
  currentPlanMd: string,
  sessionName: string
): ParsedBlock[];

export function inferMuscleGroupsForExercise(
  exerciseName: string,
  blockContext: string,
  pullSubBank?: 'lats' | 'upper_back' | 'teres_major' | 'rear_delts'
): string[];

export function parseRunningSessions(currentPlanMd: string):
  ParsedCardioSession[];

export function parseRecoveryActivities(
  currentPlanMd: string,
  planDecisionsMd: string
): ParsedRecoverySession[];

export function parseNutritionTargets(nutritionMd: string):
  ParsedNutritionTargets;

export function parseHistoricalPRs(trainingLogMd: string):
  ParsedHistoricalPR[];

export function parsePlanFromWiki(files: WikiFiles):
  TrainingPlanSpec;
```

### Muscle group inference rules

The single most subtle parsing logic is determining
`muscle_groups` for each exercise. Rules (encoded in
`inferMuscleGroupsForExercise`):

1. Block name maps to a default high-level tag set:
   - Upper Chest, Mid Chest, Lower Chest → `['chest']`
   - Shoulder Press, Lateral Raise → `['shoulders']`
   - Vertical Pull, Horizontal Pull → `['back']`
   - Rear Delts (block name) → `['shoulders', 'back']`
   - Triceps → `['arms', 'triceps']`
   - Biceps → `['arms', 'biceps']`
   - Squat, Hinge, Hip Thrust, Quad Accessory, Hamstring
     Accessory → `['legs']`
   - Calves block → `['calves']`
   - Abs → `['core']`
   - ATG Split Squat block → `['legs']`
   - Jefferson Curl, Seated Good Mornings → `['back', 'core']`
   - Tib Raises → `['legs', 'tibialis']`
   - Low Back Extensions → `['core', 'lower_back']`
2. Within Friday Pull's "Area of Focus — Back" block, the wiki
   sub-banks become granular tags appended to the high-level
   `'back'`:
   - Cable Pullover, Machine Pullover, Kneeling Single Arm Cable
     Lat Row, Single Arm Chest Supported Row →
     `['back', 'lats']` (Cable/Machine Pullover gets
     `['back', 'lats', 'teres_major']`)
   - Straight Arm Cable Pulldown → `['back', 'teres_major']`
   - Meadows Row, BB Shrug, DB Shrug → `['back', 'upper_back']`
   - Reverse Pec Deck, Single Arm Cable Rear Delt Fly, Cable Rope
     Face Pulls → `['back', 'shoulders', 'rear_delts']`
3. Exercise names with explicit muscle indicators inherit the
   block tags. No fancy NLP — the wiki is structured enough that
   exact string matching plus the block-name rules above covers
   every exercise.
4. The seed script includes a sanity check: every exercise must
   end up with at least one high-level tag (Chest / Shoulders /
   Back / Arms / Legs / Core / Calves). The check uses the
   `src/lib/methodology/muscle-groups.ts` helper.

### Plan tab page contracts

```ts
// src/app/(app)/plan/page.tsx — Screen 2A
// Server component. Fetches:
//   - active training_plan for the user
//   - all 7 daily_schedules
//   - all sessions per schedule, ordered by timing then
//     display_order
// Renders  for each day.

// src/app/(app)/plan/[day]/page.tsx — Screen 2B
// Server component. Param: day in {'mon','tue',...,'sun'}.
// Fetches:
//   - the schedule for that day
//   - all sessions
//   - for lifting sessions: blocks + bank exercises with
//     muscle_groups
// Renders  for each session.
```

## 5. Edge Cases to Handle

1. **Wiki file missing or unreadable** — seed script aborts with a
   clear "missing file: supabase/seed/wiki/X.md" error. Does not
   partially seed.
2. **Wiki file has unexpected structure** (no Weekly Schedule table,
   missing required H3 section, etc.) — parser returns a typed
   error; seed script reports which file and which section failed
   parsing, then aborts.
3. **Re-running with no wiki changes** — every upsert is a no-op;
   no rows change; the script reports "0 changes."
4. **Re-running after editing a wiki file** — the edited content's
   target rows update; everything else is unchanged. Block ordering
   honored even if blocks were reordered in the wiki.
5. **Re-running with a removed exercise** — when a block's bank
   shrinks (an exercise was removed from `current-plan.md`),
   `block_exercises` rows for the now-absent exercise are deleted
   for that block. The `exercises` row itself is NOT deleted (other
   blocks may still reference it; deletion is handled by Plan
   Editor in Slice 8 if/when needed).
6. **An exercise referenced in a block is missing a global
   definition** — every exercise mentioned in `current-plan.md`
   becomes an `exercises` row. Deduplicate by exact name match
   (`UNIQUE (user_id, name)`).
7. **Schedule validation hard-rule violation in the seeded plan** —
   the wiki should not contain hard-rule violations (Marcus's plan
   passes), but the seed script runs validation anyway and aborts
   with the violation listed if it ever does.
8. **Schedule validation soft-rule warnings** — the seed script
   prints warnings (e.g., "cardio-before-lifting on Monday") but
   continues. Marcus's actual schedule does have cardio before
   lifting on Monday (Speed Run AM → Upper); this is intentional
   per the methodology. Soft warnings during seed are
   informational.
9. **PR seeding when an exercise doesn't yet exist in the
   `exercises` table** — the seed script must seed exercises FIRST,
   then look up Bench Press / OHP / Deadlift exercise_ids by name,
   then insert pr_history rows. If any of the three exercises
   isn't found, the seed script logs the issue and skips that PR
   rather than failing.
10. **Seeding Saturday "Hot Yoga OR Sauna"** — store as one
    recovery session per day with `description='Hot Yoga or Sauna
    (alternates with Sunday)'`. The "OR" is captured in
    description text rather than a separate enum or two separate
    rows; the user picks at run-time when marking the recovery
    session done.
11. **Block 4 Friday Pull ambiguity** — verified handled per
    Decision 5: flatten all back exercises into one combined bank,
    populate granular muscle group tags. The wiki's sub-bank
    headers (Lats, Upper Back, Teres Major, Rear Delts) are not
    seeded as separate blocks.
12. **Lateral Raise block appearing twice in Push** — Block 5 and
    Block 7 are two distinct `blocks` rows with the same
    `block_name='Lateral Raise'`, different `display_order`. Both
    reference the same exercise bank.
13. **Seeded plan_templates JSON snapshot** — capture the full
    parsed `TrainingPlanSpec` including all blocks, exercises,
    notes, and the cardio/recovery sessions. This snapshot is
    Phase 4's "Train with Marcus" template content. version starts
    at 1; subsequent re-seeds with content changes increment to 2,
    3, etc.

## 6. Test Cases

Manual end-to-end tests after the seed script runs successfully.

### Database state verification

1. **Migrations applied.** In Supabase Studio → Database → Tables,
   confirm the existence of: training_plans, daily_schedules,
   sessions, blocks, exercises, block_exercises, nutrition_targets,
   meal_entries, plan_templates, pr_history. RLS is enabled on
   all of them.
2. **Plan row count.** Run `SELECT count(*) FROM training_plans
   WHERE user_id = <Marcus user_id>`. Expect 1.
3. **Schedule row count.** Run `SELECT count(*) FROM
   daily_schedules WHERE plan_id = <plan_id>`. Expect 7.
4. **Session counts per day.** Run a per-day count and verify
   against Section 2 acceptance criterion 4.
5. **Monday Upper block count.** Run `SELECT count(*) FROM blocks
   b JOIN sessions s USING (session_id) JOIN daily_schedules d
   USING (schedule_id) WHERE d.day_of_week = 'mon' AND
   s.session_name = 'Upper'`. Expect 8.
6. **Lower ATG block count.** Same query for Saturday Lower ATG.
   Expect 10.
7. **Push has 7 blocks (with Lateral Raise twice).** Same query
   for Thursday Push. Expect 7 rows; two rows where
   `block_name = 'Lateral Raise'` with different `display_order`.
8. **Bench Press has correct muscle groups.** Run `SELECT
   muscle_groups FROM exercises WHERE name = 'Barbell Bench
   Press'`. Expect array containing `'chest'`.
9. **Cable Pullover has granular tags.** Run for Cable Pullover.
   Expect array containing `['back', 'lats', 'teres_major']` (or
   superset).
10. **Saturday Lower ATG mobility blocks.** Run `SELECT
    block_name, block_type FROM blocks b JOIN sessions s USING
    (session_id) JOIN daily_schedules d USING (schedule_id)
    WHERE d.day_of_week = 'sat' AND s.session_name = 'Lower ATG'`.
    Blocks 1–8 (ATG Split Squat through Calves) should have
    `block_type='mobility'`. Blocks 9–10 (the two Abs blocks)
    should have `block_type='failure'` (abs work goes to failure).
11. **Cardio sessions structured correctly.** Verify the four
    cardio sessions (Mon Speed Run, Sat Endurance Run, Wed
    Basketball, Fri Basketball) have correct
    cardio_format/cardio_distance/cardio_target_zone.
12. **Recovery sessions seeded.** Thursday Sauna, Saturday Hot
    Yoga or Sauna, Sunday Hot Yoga or Sauna all present as
    `session_type='recovery'`.
13. **Nutrition targets row.** Run `SELECT * FROM
    nutrition_targets WHERE user_id = <Marcus>`. One row, ranges
    matching `nutrition.md`: cal 2400-2800, protein 150-175,
    carbs 200-280, fat 60-90.
14. **Three PR rows.** Run `SELECT e.name, p.weight_kg, p.reps,
    p.pr_type FROM pr_history p JOIN exercises e USING
    (exercise_id) WHERE p.user_id = <Marcus>`. Three rows: Bench
    Press 235×1, Seated Overhead BB Press 185×3, Conventional
    Deadlift 435×1, all `pr_type='weight'`.
15. **plan_templates snapshot exists.** One row,
    `is_public=false`, `version=1`, `snapshot_json` populated with
    a complete plan structure.

### Idempotency tests

16. **Re-run seed with no changes.** Run `pnpm seed` a second
    time. The script reports "0 changes" or equivalent, exit code
    0. Database row counts unchanged.
17. **Re-run seed after editing a wiki block name.** Edit
    `current-plan.md` to change "Mid Chest" to "Mid Chest Anchor"
    on Monday. Re-run seed. The corresponding `blocks` row's
    `block_name` updates. No duplicates.

### App rendering tests

18. **Plan tab loads.** Sign in, navigate to Plan tab. Screen 2A
    renders 7 day cards in week order.
19. **Card content matches database.** Each day card shows the
    correct sessions in chronological order with names, gyms,
    and brief descriptions.
20. **Tap day → Day Detail.** Tap any day's card; Screen 2B
    renders. URL updates to `/plan/[day]`.
21. **Lifting session detail.** A lifting session shows its block
    list with block names. Tap a block; the bank's exercises
    expand inline, each with its name and muscle-group caption.
22. **Cardio session detail.** Speed Run shows its description
    (warm-up + plyos + sprints + recovery details).
23. **Recovery session detail.** Thursday Sauna shows
    "Recovery: Sauna" or similar.
24. **No edit affordances.** No "edit", "add", or "delete" buttons
    visible anywhere on Plan tab.
25. **Other tabs unaffected.** Today, History, Nutrition, Settings
    still render their Slice 1 placeholders. Sign out still works.

### Code quality checks

26. `pnpm lint` passes.
27. `pnpm typecheck` passes (with regenerated types.ts).
28. `pnpm format:check` passes.
29. `git status` shows only expected new files; the wiki content
    files in `supabase/seed/wiki/*.md` are gitignored and do not
    appear.

## 7. Codex Generation Prompt (Phase 4A)
CONTEXT:
Slice 2 of training-app. The project scaffold from Slice 1 is in
place: Next.js 15 + TypeScript strict + Tailwind + shadcn + Supabase
with magic-link auth, profiles table, bottom tab bar with five
placeholder pages. The Plan tab currently renders an empty <h1>Plan
</h1> placeholder.
This slice adds the full plan/exercise/nutrition data model, a seed
script that ingests Marcus's training methodology from six wiki
markdown files, and the read-only Plan tab UI rendering the seeded
data.
Read /spec/slices/SLICE_2_PLAN_MIGRATION.md for the full slice
document. The spec docs in /spec/ (PROJECT_BRIEF.md, MASTER_SPEC.md,
ARCHITECTURE.md) are the project constitution. AGENTS.md at the root
contains the rules for this build. CLAUDE.md governs the post-
generation review pass. Read all of these before generating.
The wiki source markdown files are present at supabase/seed/wiki/:
overview.md
master-plan.md
current-plan.md
training-log.md
nutrition.md
plan-decisions.md
You may read these files to inform parser logic. They are gitignored
(per the slice spec) — do not modify them.
TASK:
Implement everything in Sections 3 and 4 of SLICE_2_PLAN_MIGRATION.md:

SQL migrations 002, 005, 006, plus extensions to 007 for the new
tables' RLS policies
Seed script seed-from-wiki.ts plus its supporting library modules
(parser, methodology-rules, supabase-admin, types, wiki-paths)
The src/lib/methodology/muscle-groups.ts helper
The src/lib/supabase/env.ts consolidation (move env getters out
of client.ts, server.ts, middleware.ts; new supabase-admin.ts
also imports from env.ts)
The Plan tab routes: /plan (Screen 2A) and /plan/[day] (Screen 2B)
The Plan-tab components: DayCard, SessionSummaryRow,
SessionDetailPanel, BlockList, ExerciseBankList
The package.json seed script
The .gitignore update for wiki content files

CONSTRAINTS:

Follow the file list in Section 3 of the slice doc verbatim. Do
not add files that aren't listed.
Migration SQL: use Section 4's SQL exactly. Do not invent
additional tables, columns, or constraints. Do not change column
names or types.
The SUPABASE_SERVICE_ROLE_KEY env var is now in use — only by
the seed script's supabase-admin client. Do NOT use it anywhere
else in the codebase. Application code (any code reachable from
src/app/, src/components/, or any browser context) uses only the
anon key.
The seed script is the only TypeScript file that uses the
service role key. It runs via pnpm seed (tsx) and is never
imported from anywhere in src/.
Idempotency: every seed step is safe to re-run. Use upserts
keyed on stable identity (user_id + name for exercises;
schedule_id + day_of_week for daily_schedules; session_id +
block_name + display_order for blocks; etc.).
Module boundary discipline:

src/lib/methodology/ is pure (no Supabase, no React)
src/lib/sync/ does not exist yet
The seed script and its lib modules live entirely in
supabase/seed/, NOT in src/lib/. They are a build-time tool,
not application code.


TypeScript strict mode. No any. No as unknown as X shortcuts.
The Plan tab is read-only. Do not add edit affordances of any
kind, even hidden behind a flag.
shadcn additions: add the Card primitive (pnpm dlx shadcn add card) for the day cards. Do not add any other shadcn
components in this slice.
Cardio session enums: use exactly these values. Do not invent
others.

cardio_format: 'speed_run', 'endurance_run', 'basketball'
cardio_target_zone: 'sprint', 'zone_2', 'anaerobic',
'game_pace'


Block 4 Friday Pull: flatten all sub-bank exercises into one
combined bank. Populate muscle_groups with both high-level
('back') and granular tags ('lats', 'teres_major',
'upper_back', 'rear_delts') per Section 4's
inferMuscleGroupsForExercise rules.
Lateral Raise block appears twice in Thursday Push (Block 5 and
Block 7) — two distinct rows in blocks, same exercise bank.
All chest exercises (any block name containing "Chest") get
is_compound=true and prescribed range 6-8.
Saturday Lower ATG blocks 1-8 get block_type='mobility'.
Blocks 9-10 (Abs) and all other lifting blocks across all
sessions get block_type='failure'.
Three historical PRs from training-log.md must be seeded into
pr_history with set_log_id=NULL and pr_type='weight'.
Schedule validation: encode the hard rules from MASTER_SPEC
Section 8 in supabase/seed/lib/methodology-rules.ts. Run them
on the parsed plan; abort with a descriptive error if any
violate. Soft-rule warnings are printed but allow the seed to
proceed.

LIVE SCHEMA AFTER MIGRATIONS APPLY (use exact column names — do
NOT invent additional columns):
[Full schema dump goes here — Codex pulls from Section 4. The
slice doc has the complete CREATE TABLE statements for every new
table. The schema is the verbatim contents of migrations 002, 005,
006.]
ACCEPTANCE CRITERIA:
See SLICE_2_PLAN_MIGRATION.md Section 2 — all 20 criteria.
DO NOT:

Add files outside Section 3
Build any feature not specified in Sections 4-6
Add automated test infrastructure
Use any state management library beyond what's already in stack
Use the service role key anywhere outside supabase/seed/
Leave placeholder TODOs or stubbed functions
Add edit affordances to the Plan tab
Modify existing migration 001 or its profiles table
Modify Slice 1's auth flow or login page
Invent any cardio_format or cardio_target_zone enum values
beyond what's specified
Skip the env.ts consolidation — it's in scope this slice

OUTPUT:
Write the complete implementation. Do not explain — just produce
the code. At the end, list:

Every column name referenced
Every env var used
Every external API endpoint called (Supabase client methods)
Every Supabase RLS policy created
Every assumption made that was not explicit in the prompt
Every wiki file path read by the parser
The exact pnpm commands run (install, seed, gen-types,
lint/typecheck/format checks)
Any deviations from the file list in Section 3
Validation warnings encountered during the test seed run
(soft-rule warnings, if any)


## 8. Claude Code Quality Review Prompt (Phase 4B — MANDATORY)
CONTEXT:
Slice 2 of training-app — Plan Migration. Codex just generated the
plan/exercise/nutrition schema migrations, a seed script that
ingests six wiki markdown files, the Plan tab UI rendering the
seeded data read-only, and the env.ts consolidation deferred from
Slice 1.
FILES CODEX TOUCHED:
[Pull from Codex's own output. Expected major files include:

supabase/migrations/002_plan_structure.sql
supabase/migrations/005_nutrition.sql
supabase/migrations/006_plan_templates.sql
supabase/migrations/007_rls_policies.sql (modified)
supabase/seed/seed-from-wiki.ts
supabase/seed/lib/parser.ts
supabase/seed/lib/methodology-rules.ts
supabase/seed/lib/supabase-admin.ts
supabase/seed/lib/types.ts
supabase/seed/lib/wiki-paths.ts
src/lib/supabase/env.ts (new)
src/lib/supabase/client.ts (modified)
src/lib/supabase/server.ts (modified)
src/lib/supabase/middleware.ts (modified)
src/lib/methodology/muscle-groups.ts (new)
src/app/(app)/plan/page.tsx (replaced)
src/app/(app)/plan/[day]/page.tsx (new)
src/components/plan/DayCard.tsx
src/components/plan/SessionSummaryRow.tsx
src/components/plan/SessionDetailPanel.tsx
src/components/plan/BlockList.tsx
src/components/plan/ExerciseBankList.tsx
src/components/ui/card.tsx (shadcn)
src/lib/supabase/types.ts (regenerated)
package.json (modified — seed script + tsx + gray-matter)
.gitignore (modified — wiki content files)]

REVIEW CHECKLIST:
Read every file in the list above and address, in order:

Schema fidelity

Migration 002, 005, 006 SQL matches Section 4 of the slice
doc exactly. No invented columns. No invented constraints.
Migration 007 adds policies for every new table. Pattern is
consistent (auth.uid() = user_id directly, or via FK chain
for tables without user_id). Append-only tables (pr_history)
get only SELECT and INSERT.
Generated types.ts in src/lib/supabase/ reflects the live
schema after migrations.


Module boundary discipline

supabase/seed/ contains zero imports from src/. The seed
script is self-contained at build time.
src/lib/methodology/muscle-groups.ts has no Supabase or
React imports. Pure functions.
src/lib/supabase/env.ts is now the single source for env-var
reads. client.ts, server.ts, middleware.ts, and
supabase-admin.ts all import from env.ts. No duplication.
Application code (anything in src/) does NOT use the service
role key. Only supabase-admin.ts (in supabase/seed/) reads
it.


Idempotency of seed

Every database write in the seed script is an upsert keyed
on stable identity. Re-running with no wiki changes results
in zero modifications.
Upserts use ON CONFLICT ... DO UPDATE or
ON CONFLICT ... DO NOTHING explicitly, not raw INSERT
followed by UPDATE-on-error.
Block reordering: if display_order changes for an existing
block, the upsert updates it. Tests this case.


Parsing correctness

parser.ts has no domain knowledge — only generic markdown
utilities (table extraction, heading extraction).
methodology-rules.ts encodes domain logic. No hardcoded
plan content (e.g., no string literal for "Cable Pullover"
in the parser — all exercise names come from the wiki).
inferMuscleGroupsForExercise rules in Section 4 are
implemented faithfully. Spot-check: does a test against
"Cable Pullover" inside Block 4 Friday Pull return
['back', 'lats', 'teres_major']?


Naming consistency

Files: kebab-case for non-component files; PascalCase for
React components.
SQL: snake_case for tables and columns.
TypeScript: camelCase for variables and functions;
PascalCase for types and components.


Error handling

Seed script fails clearly when a wiki file is missing.
Seed script fails clearly when parsing returns errors.
Seed script fails clearly when schedule validation hard rules
trip.
Seed script does NOT fail on soft-rule warnings — prints and
continues.
Plan tab pages handle "no plan exists" gracefully (renders
a fallback message rather than crashing).
Plan tab pages handle "session has no blocks" gracefully
(cardio/recovery sessions don't have blocks).


Plan tab read-only verification

No buttons labeled "edit", "add", "delete", "save",
"remove" visible anywhere on /plan or /plan/[day].
No form inputs visible.
No swap, drag, reorder affordances.


Schema fidelity in app code

Every Supabase query in src/ uses column names that exist
in the live schema. No drift.
Type imports use the regenerated Database type from
src/lib/supabase/types.ts, not hand-written types that could
drift.


Strict TypeScript

tsconfig.json strict mode preserved
No any, no widening casts
Component props typed; no implicit any
Database insert/update types use TablesInsert / TablesUpdate
from the generated types.ts


Performance

Plan tab Screen 2A makes a single round-trip to fetch all
sessions for all 7 days, not 7 separate queries.
Plan tab Screen 2B fetches blocks + exercises for the
requested day's sessions in one query (or the minimum
required), not N+1 per block.


.env.example currency

SUPABASE_SERVICE_ROLE_KEY documented.
SEED_TARGET_USER_ID (if added per Section 4 step 3) is
documented in .env.example.
No new env vars introduced that aren't in .env.example.


.gitignore correctness

supabase/seed/wiki/*.md gitignored
supabase/seed/wiki/.gitkeep NOT gitignored (folder
structure preserved)


shadcn Card primitive present

src/components/ui/card.tsx exists from pnpm dlx shadcn add card. No other new shadcn components added beyond Card.


PR seeding correctness

Three rows in pr_history matching the wiki: Bench 235×1,
OHP 185×3, Deadlift 435×1.
All have pr_type='weight', set_log_id=NULL.
Idempotent: re-running seed does not duplicate.


Block_type assignments

Saturday Lower ATG blocks 1-8: block_type='mobility'
Saturday Lower ATG blocks 9-10 (Abs): block_type='failure'
All other lifting blocks across all sessions:
block_type='failure'



AUTO-FIX vs FLAG:

Auto-fix: items 1-15 above when the fix is local and unambiguous
Flag for approval:

Any deviation from Section 3's file list
Any new dependency beyond tsx, gray-matter, and shadcn Card
Structural changes that affect multiple files
Subjective style preferences when existing code is acceptable



CONSTRAINTS:

Do not add new features
Do not change the folder structure from /spec/ARCHITECTURE.md
Do not modify files outside the list above
Do not introduce new dependencies beyond Section 3's allowance

OUTPUT:
Summary with four parts:

Files changed and why (one line each)
Items flagged for user approval with reasoning
Any issues logged for KNOWN_ISSUES.md
Ready-for-testing verdict (yes / no — if no, what's blocking)


## 9. Claude Code Debugging Prompt (Phase 4C)

Used only if Section 6 test cases fail after the quality review pass.
Fill in CURRENT PROBLEM with the exact failure when needed.
CONTEXT:
Slice 2 of training-app — Plan Migration. Codex generated the schema
migrations, seed script, and Plan tab UI; Claude Code completed the
quality review pass. Tests in Section 6 of SLICE_2_PLAN_MIGRATION.md
are now being run.
CURRENT PROBLEM:
[Fill in: exact error message, console output, or description of
which acceptance criterion is failing. Examples:

"supabase db push fails on migration 002 with: <paste exact
error>"
"pnpm seed fails after parsing current-plan.md with: <paste
stack trace>"
"Plan tab Screen 2A renders 6 cards instead of 7"
"Block count for Monday Upper is 9, expected 8"
"Cable Pullover muscle_groups is ['back'] only — missing
granular tags"
Be specific. "It crashes" or "it's broken" is not enough. Include
the exact wiki content the parser was processing if a parser bug.]

RELEVANT FILES:
[List of files involved. Examples for various failure types:

Migration failure: supabase/migrations/<file>.sql, the prior
migration files for context
Seed parsing failure: supabase/seed/seed-from-wiki.ts plus
the relevant lib/methodology-rules.ts function plus the wiki
file being parsed
Seed write failure: seed-from-wiki.ts plus supabase-admin.ts
plus the relevant migration's SQL
Plan tab rendering failure: src/app/(app)/plan/page.tsx plus
the affected component
Use paths from project root.]

WHAT CODEX BUILT / QUALITY REVIEW COVERED:
[Brief summary — what's working, what's not, what the review pass
already addressed. Reference the specific quality review items
that touched the affected files.]
CONSTRAINTS:

Next.js 15 App Router, TypeScript strict, Supabase via
@supabase/ssr, seed script via tsx
Do not refactor outside the current problem
Do not change the folder structure from /spec/ARCHITECTURE.md
Do not introduce new dependencies
The schema is locked — do not modify migration files unless the
problem is a literal SQL syntax error in a migration
Idempotency must be preserved — fixes to the seed script must
not introduce duplicate-row possibilities

ACCEPTANCE CRITERIA:
[Copy in only the criteria from Section 2 that the current failure
relates to.]
DO NOT:

Rewrite files that are working
Add features outside the current fix
Change the folder structure from ARCHITECTURE.md
Generate a new slice from scratch — if that is what's needed,
stop and tell me to take it to Codex first
Modify the wiki content files in supabase/seed/wiki/

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any
follow-up issues for the next session.
