-- Slice 16 — reusable workout catalog.
-- A workout_def is an owner-scoped, reusable workout composed of lifting blocks.
-- The Library "Workouts" tab is the single place a workout's contents are edited;
-- plans reference these via workouts.workout_def_id (added in migration 020).

CREATE TABLE workout_defs (
  workout_def_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  workout_type session_type_enum NOT NULL DEFAULT 'lifting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE INDEX idx_workout_defs_owner
  ON workout_defs (owner_user_id);

CREATE TRIGGER workout_defs_set_updated_at
  BEFORE UPDATE ON workout_defs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workout_def_blocks (
  workout_def_id uuid NOT NULL REFERENCES workout_defs(workout_def_id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workout_def_id, block_id)
);

CREATE INDEX idx_workout_def_blocks_def
  ON workout_def_blocks (workout_def_id, display_order);

ALTER TABLE workout_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_def_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON workout_defs
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "insert_own" ON workout_defs
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "update_own" ON workout_defs
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "delete_own" ON workout_defs
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "select_own" ON workout_def_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM workout_defs AS d
      WHERE d.workout_def_id = workout_def_blocks.workout_def_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON workout_def_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_defs AS d
      WHERE d.workout_def_id = workout_def_blocks.workout_def_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON workout_def_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM workout_defs AS d
      WHERE d.workout_def_id = workout_def_blocks.workout_def_id
        AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON workout_def_blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM workout_defs AS d
      WHERE d.workout_def_id = workout_def_blocks.workout_def_id
        AND d.owner_user_id = auth.uid()
    )
  );
