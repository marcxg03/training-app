ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- No DELETE policy. Profile rows are tied to auth.users via ON DELETE
-- CASCADE; deleting the user deletes the profile. Direct profile
-- deletion is not exposed.
