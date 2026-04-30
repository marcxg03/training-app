-- Idempotent. Safe to run multiple times.
CREATE TYPE goal_mode_enum AS ENUM ('cut', 'maintain', 'lean_bulk');

CREATE TABLE profiles (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text,
  bodyweight_kg  numeric,
  height_cm      numeric,
  goal_mode      goal_mode_enum NOT NULL DEFAULT 'maintain',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
