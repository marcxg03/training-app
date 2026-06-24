-- Slice 17 — link a scheduled workout back to its reusable definition.
-- A workouts row created by assigning a catalog workout to a plan day carries
-- workout_def_id; its blocks resolve live from the def's workout_def_blocks until
-- the workout is started/logged (when workout_blocks is materialized as a
-- snapshot). Ad-hoc per-day workouts leave this NULL and behave as before.
-- ON DELETE SET NULL is a backstop; the app guards def deletion when scheduled.

ALTER TABLE workouts
  ADD COLUMN workout_def_id uuid
  REFERENCES workout_defs(workout_def_id) ON DELETE SET NULL;

CREATE INDEX idx_workouts_workout_def
  ON workouts (workout_def_id);
