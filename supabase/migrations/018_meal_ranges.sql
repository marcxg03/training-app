-- ============================================================
-- Migration 018: macro/calorie ranges on meal_entries (Slice 13)
--
-- Meals become range-based: each macro and calories store a min and a max.
-- An exact entry is simply min = max. Existing single-value columns
-- (protein_g/carbs_g/fat_g/calories) are backfilled into the ranges and then
-- made nullable — they are deprecated (no longer written by the app) but kept
-- so historical rows are preserved without a destructive column drop.
-- ============================================================

-- 1. Add range columns. NOT NULL DEFAULT 0 lets the ALTER fill existing rows;
--    the app always supplies real values on insert.
ALTER TABLE meal_entries
  ADD COLUMN protein_min_g numeric NOT NULL DEFAULT 0,
  ADD COLUMN protein_max_g numeric NOT NULL DEFAULT 0,
  ADD COLUMN carbs_min_g   numeric NOT NULL DEFAULT 0,
  ADD COLUMN carbs_max_g   numeric NOT NULL DEFAULT 0,
  ADD COLUMN fat_min_g     numeric NOT NULL DEFAULT 0,
  ADD COLUMN fat_max_g     numeric NOT NULL DEFAULT 0,
  ADD COLUMN cal_min       numeric NOT NULL DEFAULT 0,
  ADD COLUMN cal_max       numeric NOT NULL DEFAULT 0;

-- 2. Backfill ranges from the existing single values (exact = min = max).
UPDATE meal_entries SET
  protein_min_g = protein_g, protein_max_g = protein_g,
  carbs_min_g   = carbs_g,   carbs_max_g   = carbs_g,
  fat_min_g     = fat_g,     fat_max_g     = fat_g,
  cal_min       = calories,  cal_max       = calories;

-- 3. Deprecate the single-value columns (kept for history, no longer required).
ALTER TABLE meal_entries
  ALTER COLUMN protein_g DROP NOT NULL,
  ALTER COLUMN carbs_g   DROP NOT NULL,
  ALTER COLUMN fat_g     DROP NOT NULL,
  ALTER COLUMN calories  DROP NOT NULL;

-- 4. Range integrity: max >= min (min = max allowed for exact entries), min >= 0.
ALTER TABLE meal_entries
  ADD CONSTRAINT meal_entries_protein_range
    CHECK (protein_max_g >= protein_min_g AND protein_min_g >= 0),
  ADD CONSTRAINT meal_entries_carbs_range
    CHECK (carbs_max_g >= carbs_min_g AND carbs_min_g >= 0),
  ADD CONSTRAINT meal_entries_fat_range
    CHECK (fat_max_g >= fat_min_g AND fat_min_g >= 0),
  ADD CONSTRAINT meal_entries_cal_range
    CHECK (cal_max >= cal_min AND cal_min >= 0);
