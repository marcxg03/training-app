CREATE TYPE day_of_week_enum AS ENUM (
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
);

CREATE TYPE session_type_enum AS ENUM (
  'lifting', 'cardio', 'recovery'
);

CREATE TYPE timing_enum AS ENUM ('am', 'pm', 'anytime');

CREATE TYPE block_type_enum AS ENUM (
  'failure', 'mobility', 'corrective'
);

CREATE TYPE cardio_format_enum AS ENUM (
  'speed_run', 'endurance_run', 'basketball'
);

CREATE TYPE cardio_target_zone_enum AS ENUM (
  'sprint', 'zone_2', 'anaerobic', 'game_pace'
);

CREATE TABLE training_plans (
  plan_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_plans_user
  ON training_plans (user_id, is_active);

CREATE TABLE daily_schedules (
  schedule_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES training_plans(plan_id)
                 ON DELETE CASCADE,
  day_of_week  day_of_week_enum NOT NULL,
  is_rest_day  boolean NOT NULL DEFAULT false,
  UNIQUE (plan_id, day_of_week)
);

CREATE TABLE sessions (
  session_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        uuid NOT NULL REFERENCES daily_schedules(schedule_id)
                       ON DELETE CASCADE,
  session_type       session_type_enum NOT NULL,
  session_name       text NOT NULL,
  timing             timing_enum NOT NULL DEFAULT 'anytime',
  gym                text,
  description        text,
  display_order      integer NOT NULL,
  cardio_format      cardio_format_enum,
  cardio_distance    text,
  cardio_target_zone cardio_target_zone_enum,
  CHECK (
    (session_type = 'cardio' AND cardio_format IS NOT NULL)
    OR
    (session_type != 'cardio' AND cardio_format IS NULL
     AND cardio_distance IS NULL AND cardio_target_zone IS NULL)
  )
);

CREATE INDEX idx_sessions_schedule
  ON sessions (schedule_id, display_order);

CREATE TABLE blocks (
  block_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(session_id)
                  ON DELETE CASCADE,
  block_name    text NOT NULL,
  block_type    block_type_enum NOT NULL DEFAULT 'failure',
  display_order integer NOT NULL
);

CREATE INDEX idx_blocks_session
  ON blocks (session_id, display_order);

CREATE TABLE exercises (
  exercise_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  name           text NOT NULL,
  notes          text NOT NULL DEFAULT '',
  prescribed_min integer NOT NULL,
  prescribed_max integer NOT NULL,
  muscle_groups  text[] NOT NULL DEFAULT '{}',
  is_compound    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name),
  CHECK (prescribed_min > 0 AND prescribed_max >= prescribed_min)
);

CREATE INDEX idx_exercises_user
  ON exercises (user_id);

CREATE INDEX idx_exercises_muscle_groups
  ON exercises USING GIN (muscle_groups);

CREATE TRIGGER exercises_set_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE block_exercises (
  block_id      uuid NOT NULL REFERENCES blocks(block_id)
                  ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES exercises(exercise_id)
                  ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, exercise_id)
);

CREATE INDEX idx_block_exercises_block
  ON block_exercises (block_id, display_order);
