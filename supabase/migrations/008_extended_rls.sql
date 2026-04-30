ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON training_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON training_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON training_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON training_plans
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON daily_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_plans p
      WHERE p.plan_id = daily_schedules.plan_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON daily_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_plans p
      WHERE p.plan_id = daily_schedules.plan_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON daily_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM training_plans p
      WHERE p.plan_id = daily_schedules.plan_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON daily_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM training_plans p
      WHERE p.plan_id = daily_schedules.plan_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM daily_schedules d
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE d.schedule_id = sessions.schedule_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM daily_schedules d
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE d.schedule_id = sessions.schedule_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM daily_schedules d
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE d.schedule_id = sessions.schedule_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM daily_schedules d
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE d.schedule_id = sessions.schedule_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE s.session_id = blocks.session_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sessions s
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE s.session_id = blocks.session_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE s.session_id = blocks.session_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM sessions s
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE s.session_id = blocks.session_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON exercises
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON exercises
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON exercises
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON block_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM blocks b
      JOIN sessions s ON s.session_id = b.session_id
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE b.block_id = block_exercises.block_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own" ON block_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM blocks b
      JOIN sessions s ON s.session_id = b.session_id
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE b.block_id = block_exercises.block_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own" ON block_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM blocks b
      JOIN sessions s ON s.session_id = b.session_id
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE b.block_id = block_exercises.block_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own" ON block_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM blocks b
      JOIN sessions s ON s.session_id = b.session_id
      JOIN daily_schedules d ON d.schedule_id = s.schedule_id
      JOIN training_plans p ON p.plan_id = d.plan_id
      WHERE b.block_id = block_exercises.block_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "select_own" ON nutrition_targets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON nutrition_targets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON nutrition_targets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON nutrition_targets
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON meal_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON meal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON meal_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON meal_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON plan_templates
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "insert_own" ON plan_templates
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "update_own" ON plan_templates
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "delete_own" ON plan_templates
  FOR DELETE USING (auth.uid() = owner_user_id);

-- pr_history is append-only at the DB layer. SELECT and INSERT only.
-- No UPDATE policy. No DELETE policy. PRs are immutable history.
CREATE POLICY "select_own" ON pr_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON pr_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
