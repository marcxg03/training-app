ALTER TABLE cardio_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_cardio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_recovery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON blocks;
DROP POLICY IF EXISTS "insert_own" ON blocks;
DROP POLICY IF EXISTS "update_own" ON blocks;
DROP POLICY IF EXISTS "delete_own" ON blocks;

DROP POLICY IF EXISTS "select_own" ON block_lifting_items;
DROP POLICY IF EXISTS "insert_own" ON block_lifting_items;
DROP POLICY IF EXISTS "update_own" ON block_lifting_items;
DROP POLICY IF EXISTS "delete_own" ON block_lifting_items;

CREATE POLICY "select_own" ON blocks
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "insert_own" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "update_own" ON blocks
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "delete_own" ON blocks
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "select_own" ON block_lifting_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_lifting_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON block_lifting_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_lifting_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON block_lifting_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_lifting_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON block_lifting_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_lifting_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON cardio_activities
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "insert_own" ON cardio_activities
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "update_own" ON cardio_activities
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "delete_own" ON cardio_activities
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "select_own" ON recovery_activities
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "insert_own" ON recovery_activities
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "update_own" ON recovery_activities
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "delete_own" ON recovery_activities
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "select_own" ON activity_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON activity_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON activity_completions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON activity_completions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON workout_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM workouts AS w
      JOIN daily_schedules AS d ON d.schedule_id = w.schedule_id
      JOIN training_plans AS p ON p.plan_id = d.plan_id
      WHERE w.workout_id = workout_blocks.workout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON workout_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workouts AS w
      JOIN daily_schedules AS d ON d.schedule_id = w.schedule_id
      JOIN training_plans AS p ON p.plan_id = d.plan_id
      WHERE w.workout_id = workout_blocks.workout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON workout_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM workouts AS w
      JOIN daily_schedules AS d ON d.schedule_id = w.schedule_id
      JOIN training_plans AS p ON p.plan_id = d.plan_id
      WHERE w.workout_id = workout_blocks.workout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON workout_blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM workouts AS w
      JOIN daily_schedules AS d ON d.schedule_id = w.schedule_id
      JOIN training_plans AS p ON p.plan_id = d.plan_id
      WHERE w.workout_id = workout_blocks.workout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON block_cardio_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_cardio_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON block_cardio_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_cardio_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON block_cardio_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_cardio_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON block_cardio_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_cardio_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON block_recovery_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_recovery_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON block_recovery_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_recovery_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON block_recovery_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_recovery_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON block_recovery_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM blocks AS b
      WHERE b.block_id = block_recovery_items.block_id
        AND b.owner_user_id = auth.uid()
    )
  );
