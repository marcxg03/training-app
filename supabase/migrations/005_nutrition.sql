CREATE TABLE nutrition_targets (
  target_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES auth.users(id)
                   ON DELETE CASCADE,
  cal_min        integer NOT NULL,
  cal_max        integer NOT NULL,
  protein_min_g  integer NOT NULL,
  protein_max_g  integer NOT NULL,
  carbs_min_g    integer NOT NULL,
  carbs_max_g    integer NOT NULL,
  fat_min_g      integer NOT NULL,
  fat_max_g      integer NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (cal_min < cal_max),
  CHECK (protein_min_g < protein_max_g),
  CHECK (carbs_min_g < carbs_max_g),
  CHECK (fat_min_g < fat_max_g)
);

CREATE TRIGGER nutrition_targets_set_updated_at
  BEFORE UPDATE ON nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE meal_entries (
  meal_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  meal_type  text NOT NULL,
  protein_g  numeric NOT NULL,
  carbs_g    numeric NOT NULL,
  fat_g      numeric NOT NULL,
  calories   numeric NOT NULL,
  note       text,
  logged_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0)
);

CREATE INDEX idx_meal_entries_user_date
  ON meal_entries (user_id, date);
