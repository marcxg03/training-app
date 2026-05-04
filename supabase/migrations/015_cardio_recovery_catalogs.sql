CREATE TABLE cardio_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cardio_format cardio_format_enum NOT NULL,
  cardio_distance text,
  cardio_target_zone cardio_target_zone_enum NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE INDEX idx_cardio_activities_owner
  ON cardio_activities (owner_user_id);

CREATE TRIGGER cardio_activities_set_updated_at
  BEFORE UPDATE ON cardio_activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE recovery_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE INDEX idx_recovery_activities_owner
  ON recovery_activities (owner_user_id);

CREATE TRIGGER recovery_activities_set_updated_at
  BEFORE UPDATE ON recovery_activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE block_cardio_items (
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES cardio_activities(activity_id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, activity_id)
);

CREATE INDEX idx_block_cardio_items_block
  ON block_cardio_items (block_id, display_order);

CREATE TABLE block_recovery_items (
  block_id uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES recovery_activities(activity_id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, activity_id)
);

CREATE INDEX idx_block_recovery_items_block
  ON block_recovery_items (block_id, display_order);

CREATE TABLE activity_completions (
  completion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('cardio', 'recovery')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_minutes integer,
  perceived_intensity text,
  notes text,
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX idx_activity_completions_user_workout
  ON activity_completions (user_id, workout_id);

CREATE INDEX idx_activity_completions_user_started
  ON activity_completions (user_id, started_at DESC);
