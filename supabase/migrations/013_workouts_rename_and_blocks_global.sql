-- ============================================================
-- Step 0 — Test-data wipe (Slices 4-6 verification data only)
--
-- Wipes test-only rows that pre-date the global-blocks model.
-- Preserves Slice 2's 3 seeded historical PRs (set_log_id IS NULL),
-- daily_schedules, training_plans, exercises, profiles.
-- The seed re-runs from edited wiki after migrations 013-016 apply
-- and repopulates blocks (deduplicated globally), block_lifting_items,
-- workout_blocks, and the new cardio/recovery catalogs.
-- ============================================================
DELETE FROM pr_history WHERE set_log_id IS NOT NULL;
DELETE FROM set_logs;
DELETE FROM session_completions;
DELETE FROM block_exercises;
DELETE FROM blocks;
-- sessions table preserved (gets renamed → workouts below)

-- ============================================================
-- Step 1 — Rename sessions → workouts cascade
-- ============================================================
ALTER TABLE sessions RENAME TO workouts;
ALTER TABLE workouts RENAME COLUMN session_id TO workout_id;
ALTER TABLE workouts RENAME COLUMN session_name TO workout_name;
ALTER TABLE workouts RENAME COLUMN session_type TO workout_type;

ALTER TABLE session_completions RENAME TO workout_completions;
ALTER TABLE workout_completions RENAME COLUMN session_id TO workout_id;

ALTER TABLE set_logs RENAME COLUMN session_id TO workout_id;

CREATE TYPE block_category_enum AS ENUM ('lifting', 'cardio', 'recovery');

ALTER TABLE block_exercises RENAME TO block_lifting_items;

ALTER TABLE blocks
  ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN block_category block_category_enum;

UPDATE blocks AS b
SET
  owner_user_id = source.user_id_from_plan,
  block_category = CASE
    WHEN source.workout_type = 'lifting' THEN 'lifting'::block_category_enum
    WHEN source.workout_type = 'cardio' THEN 'cardio'::block_category_enum
    WHEN source.workout_type = 'recovery' THEN 'recovery'::block_category_enum
    ELSE NULL
  END
FROM (
  SELECT
    w.workout_id,
    w.workout_type,
    p.user_id AS user_id_from_plan
  FROM workouts AS w
  JOIN daily_schedules AS d ON d.schedule_id = w.schedule_id
  JOIN training_plans AS p ON p.plan_id = d.plan_id
) AS source
WHERE b.session_id = source.workout_id;

ALTER TABLE blocks ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE blocks ALTER COLUMN block_category SET NOT NULL;
ALTER TABLE blocks ALTER COLUMN block_type DROP NOT NULL;

ALTER TABLE blocks
  ADD CONSTRAINT blocks_lifting_has_type
  CHECK (
    (block_category = 'lifting' AND block_type IS NOT NULL)
    OR (block_category != 'lifting' AND block_type IS NULL)
  );

CREATE UNIQUE INDEX idx_blocks_owner_name
  ON blocks (owner_user_id, block_name);

CREATE INDEX idx_blocks_owner_category
  ON blocks (owner_user_id, block_category);
