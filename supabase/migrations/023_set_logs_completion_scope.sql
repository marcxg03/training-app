-- Scope set logs to a workout completion (a session), not to a workout.
--
-- A weekly plan reuses the same workout_id every week, so set_logs keyed only
-- by workout_id made week 2 load week 1's sets. The logger then read those
-- stale sets as the current session's, marked every 'failure' block complete
-- (isBlockComplete counts set_index values), auto-wrote completed_at during
-- render, and locked the user out of Monday's workout.
--
-- The old UNIQUE (user_id, workout_id, block_id, set_index) made this
-- unrecoverable in the app: re-logging set 1 the next week raised 23505, which
-- lib/sync/classify.ts treats as non-retryable. Re-scoping that constraint to
-- the completion keeps its real job (idempotent replay of a queued insert, and
-- a double-tap guard) while allowing the same workout to be logged every week.
--
-- APPLY WITH `supabase db push`, which runs each migration file inside one
-- transaction. Do NOT paste this into the dashboard SQL editor: there the
-- statements commit independently, and a mid-file failure would leave the
-- column added but the constraint unswapped, with nothing recorded in
-- schema_migrations and the file un-editable per CLAUDE.md. (No explicit
-- BEGIN/COMMIT here — it would nest inside the CLI's own transaction and
-- commit it early.)

-- Composite target for the ownership FK below. UNIQUE (user_id, completion_id)
-- is redundant with the completion_id primary key, but a foreign key must
-- reference a uniquely-constrained column set.
ALTER TABLE workout_completions
ADD CONSTRAINT workout_completions_user_completion_key
  UNIQUE (user_id, completion_id);

-- The FK is composite (user_id, completion_id) so "this set belongs to a
-- session I own" is a structural invariant rather than an RLS assumption.
-- Referential-integrity checks bypass row security, so a plain
-- completion_id-only FK would let a client attach its own set logs to another
-- user's completion — invisible to that user, and (with the FK) unremovable.
--
-- No ON DELETE action (i.e. NO ACTION, checked at end of statement) rather
-- than RESTRICT (checked immediately, per row): deleting a training plan
-- cascades to workouts, which cascades to set_logs AND workout_completions as
-- siblings in one statement. RESTRICT aborts that legitimate cascade and makes
-- any plan with logged history permanently undeletable (deletePlan in
-- src/lib/plan/plan-mutations.ts). NO ACTION still refuses a bare
-- DELETE FROM workout_completions, so append-only history is never silently
-- destroyed.
ALTER TABLE set_logs
ADD COLUMN completion_id uuid;

ALTER TABLE set_logs
ADD CONSTRAINT set_logs_completion_owner_fkey
  FOREIGN KEY (user_id, completion_id)
  REFERENCES workout_completions(user_id, completion_id);

-- Backfill: a set belongs to the most recent completion of the same workout
-- that had already started when the set was logged. Deliberately keyed on
-- started_at only -- completed_at is unreliable on rows corrupted by the
-- auto-complete-on-render path this migration exists to fix. Sets with no
-- matching completion stay NULL; Postgres treats NULLs as distinct, so they
-- never collide under the new constraint, and MATCH SIMPLE means the composite
-- FK above is not enforced for them either.
UPDATE set_logs s
SET completion_id = (
  SELECT c.completion_id
  FROM workout_completions c
  WHERE c.user_id = s.user_id
    AND c.workout_id = s.workout_id
    AND c.started_at <= s.logged_at
  ORDER BY c.started_at DESC
  LIMIT 1
)
WHERE s.completion_id IS NULL;

ALTER TABLE set_logs
DROP CONSTRAINT IF EXISTS set_logs_user_session_block_set_index_key;

ALTER TABLE set_logs
ADD CONSTRAINT set_logs_user_completion_block_set_index_key
  UNIQUE (user_id, completion_id, block_id, set_index);

CREATE INDEX idx_set_logs_completion
  ON set_logs (completion_id, block_id, set_index);
