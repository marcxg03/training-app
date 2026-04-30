CREATE TABLE plan_templates (
  template_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  version        integer NOT NULL,
  is_public      boolean NOT NULL DEFAULT false,
  snapshot_json  jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, version)
);

CREATE TYPE pr_type_enum AS ENUM ('weight', 'in_range_rep');

CREATE TABLE pr_history (
  pr_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id)
                 ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(exercise_id)
                 ON DELETE CASCADE,
  set_log_id   uuid,
  pr_type      pr_type_enum NOT NULL,
  weight_kg    numeric NOT NULL,
  reps         integer NOT NULL,
  achieved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_history_user_exercise
  ON pr_history (user_id, exercise_id, weight_kg DESC, reps DESC);

CREATE INDEX idx_pr_history_user_type
  ON pr_history (user_id, pr_type);
