-- One-time data repair. Run AFTER migration 023 AND after the new code is
-- deployed. Not a migration: this fixes rows the old bug wrote, not the schema.
--
-- ORDER MATTERS. Running this while the OLD code is still serving is useless:
-- the old logger re-derives "every block complete" from prior weeks' set_logs
-- and re-writes completed_at the moment you open the workout, undoing the
-- repair. Apply 023 → deploy → then run this.
--
-- WHAT IT TARGETS. Before 023 the logger loaded every prior week's set_logs
-- for a workout, read them as the current session's, concluded every block was
-- already complete, and wrote completed_at during a GET render — marking a
-- workout "Completed" that was never performed and locking the logger.
--
-- The signature of those phantom rows is narrow and all three parts matter:
--   * completed_at set, but no set_logs in the session's own window
--   * was_ended_early = false — the render path only ever wrote completed_at,
--     never this flag. A session you genuinely ended early with no sets logged
--     has was_ended_early = true and MUST NOT be reopened.
--   * near-zero duration — the write happened in the same request that created
--     the completion. A real session that logged nothing still took minutes.
-- Matching on "no sets logged" alone would also catch legitimate history.

-- ── Step 0: backup ──────────────────────────────────────────────────────────
-- The UPDATE below overwrites completed_block_ids and was_ended_early. There
-- is no other undo. Drop this table once you are satisfied.
CREATE TABLE repair_023_backup AS
SELECT * FROM workout_completions WHERE completed_at IS NOT NULL;

-- ── Step 1: diagnose ────────────────────────────────────────────────────────
-- Review this output. For the reported bug expect this Monday's lifting
-- workout, with a duration of a second or less.
-- References s.completion_id so it errors out if 023 has not been applied.
SELECT
  c.completion_id,
  w.workout_name,
  c.started_at,
  c.completed_at,
  c.completed_at - c.started_at AS duration,
  c.was_ended_early,
  (SELECT count(*) FROM set_logs s WHERE s.completion_id = c.completion_id)
    AS sets_linked_after_backfill
FROM workout_completions c
JOIN workouts w USING (workout_id)
WHERE c.completed_at IS NOT NULL
  AND c.was_ended_early = false
  AND c.completed_at - c.started_at < interval '60 seconds'
  AND NOT EXISTS (
    SELECT 1
    FROM set_logs s
    WHERE s.completion_id = c.completion_id
  )
ORDER BY c.started_at DESC;

-- ── Step 2: reopen ──────────────────────────────────────────────────────────
-- Paste the completion_id values from step 1 that you actually want reopened.
-- An explicit list (rather than re-running the predicate) means you repair
-- exactly the rows you reviewed — nothing that completed in between, and
-- nothing the heuristic caught that you disagreed with.
BEGIN;

UPDATE workout_completions
SET
  completed_at = NULL,
  completed_block_ids = '{}'
WHERE completion_id IN (
  -- '00000000-0000-0000-0000-000000000000',
  -- '11111111-1111-1111-1111-111111111111'
)
RETURNING completion_id, workout_id, started_at;

-- Check the RETURNING output matches what you pasted, then:
COMMIT;   -- or ROLLBACK; if it does not

-- ── Step 3: confirm ─────────────────────────────────────────────────────────
-- Re-run step 1. The rows you reopened should be gone from the result.
-- Then open /today: the workout shows "Start" again.
