-- ============================================================
-- Migration 017: Library edit uniqueness constraints
--
-- Defensively guarantees the UNIQUE constraints required by
-- Slice 7b's UI-layer uniqueness validation.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cardio_activities_owner_name
  ON cardio_activities (owner_user_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_activities_owner_name
  ON recovery_activities (owner_user_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_block_lifting_items_block_exercise
  ON block_lifting_items (block_id, exercise_id);
