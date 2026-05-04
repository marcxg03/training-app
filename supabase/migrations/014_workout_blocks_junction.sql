CREATE TABLE workout_blocks (
  workout_id uuid NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  display_order integer NOT NULL,
  preset_activity_id uuid,
  preset_activity_type text CHECK (preset_activity_type IN ('cardio', 'recovery')),
  PRIMARY KEY (workout_id, block_id, display_order),
  CHECK (
    (preset_activity_id IS NULL AND preset_activity_type IS NULL)
    OR (preset_activity_id IS NOT NULL AND preset_activity_type IS NOT NULL)
  )
);

CREATE INDEX idx_workout_blocks_workout_order
  ON workout_blocks (workout_id, display_order);

CREATE INDEX idx_workout_blocks_block
  ON workout_blocks (block_id);

INSERT INTO workout_blocks (
  workout_id,
  block_id,
  display_order,
  preset_activity_id,
  preset_activity_type
)
SELECT
  b.session_id AS workout_id,
  b.block_id,
  b.display_order,
  NULL,
  NULL
FROM blocks AS b
WHERE b.session_id IS NOT NULL;

DROP POLICY IF EXISTS "select_own" ON blocks;
DROP POLICY IF EXISTS "insert_own" ON blocks;
DROP POLICY IF EXISTS "update_own" ON blocks;
DROP POLICY IF EXISTS "delete_own" ON blocks;

DROP POLICY IF EXISTS "select_own" ON block_lifting_items;
DROP POLICY IF EXISTS "insert_own" ON block_lifting_items;
DROP POLICY IF EXISTS "update_own" ON block_lifting_items;
DROP POLICY IF EXISTS "delete_own" ON block_lifting_items;

ALTER TABLE blocks DROP COLUMN session_id;
