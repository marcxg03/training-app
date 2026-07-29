-- Bodyweight quick-log: one entry per user per local day, kg stored (lbs
-- displayed, same as set_logs). profiles.bodyweight_kg stays the "current"
-- value and is updated alongside each log.

CREATE TABLE bodyweight_logs (
  bodyweight_log_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date           date NOT NULL,
  weight_kg          numeric(6,3) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  logged_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX idx_bodyweight_logs_user_date
  ON bodyweight_logs (user_id, log_date DESC);

ALTER TABLE bodyweight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON bodyweight_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON bodyweight_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON bodyweight_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON bodyweight_logs
  FOR DELETE USING (auth.uid() = user_id);
