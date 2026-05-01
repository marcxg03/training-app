ALTER TABLE exercises
ADD COLUMN is_bodyweight boolean NOT NULL DEFAULT false;

CREATE TABLE set_logs (
  set_log_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       uuid NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  block_id         uuid NOT NULL REFERENCES blocks(block_id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES exercises(exercise_id) ON DELETE CASCADE,
  set_index        integer NOT NULL CHECK (set_index > 0),
  weight_kg        numeric,
  reps             integer NOT NULL CHECK (reps > 0),
  is_to_failure    boolean NOT NULL DEFAULT false,
  prescribed_min   integer NOT NULL CHECK (prescribed_min > 0),
  prescribed_max   integer NOT NULL CHECK (prescribed_max >= prescribed_min),
  notes            text,
  logged_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_set_logs_user_session
  ON set_logs (user_id, session_id, logged_at DESC);

CREATE INDEX idx_set_logs_user_block
  ON set_logs (user_id, block_id, set_index);

CREATE INDEX idx_set_logs_user_exercise
  ON set_logs (user_id, exercise_id, logged_at DESC);

CREATE TABLE session_completions (
  completion_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id            uuid NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  completed_block_ids   uuid[] NOT NULL DEFAULT '{}'::uuid[],
  was_ended_early       boolean NOT NULL DEFAULT false,
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX idx_session_completions_user_session_started
  ON session_completions (user_id, session_id, started_at DESC);

CREATE INDEX idx_session_completions_user_active
  ON session_completions (user_id, completed_at);

ALTER TABLE pr_history
ADD CONSTRAINT pr_history_set_log_id_fkey
FOREIGN KEY (set_log_id) REFERENCES set_logs(set_log_id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_pr_history_set_log_pr_type_unique
  ON pr_history (set_log_id, pr_type)
  WHERE set_log_id IS NOT NULL;
