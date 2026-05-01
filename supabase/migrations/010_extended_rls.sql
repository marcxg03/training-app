ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON set_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON set_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON set_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON set_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "select_own" ON session_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON session_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON session_completions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON session_completions
  FOR DELETE USING (auth.uid() = user_id);
