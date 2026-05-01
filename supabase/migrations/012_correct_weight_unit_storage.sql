ALTER TABLE set_logs
ALTER COLUMN weight_kg TYPE numeric(7,3)
USING CASE
  WHEN weight_kg IS NULL THEN NULL
  ELSE ROUND(weight_kg::numeric, 3)
END;

ALTER TABLE pr_history
ALTER COLUMN weight_kg TYPE numeric(7,3)
USING ROUND(weight_kg::numeric, 3);

UPDATE set_logs
SET weight_kg = ROUND((weight_kg * 0.45359237)::numeric, 3)
WHERE weight_kg > 0
  AND logged_at < '2026-05-01 16:30:00+00';

UPDATE pr_history
SET weight_kg = ROUND((weight_kg * 0.45359237)::numeric, 3)
WHERE weight_kg > 0
  AND achieved_at < '2026-05-01 16:30:00+00';
