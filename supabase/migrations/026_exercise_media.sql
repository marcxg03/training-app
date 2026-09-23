-- Pluggable exercise media + catalog provenance (D26, D27).
--
-- Three additive, NULLABLE columns on `exercises`. Nothing is renamed, nothing
-- is dropped, no existing row changes value, and every column is optional —
-- an exercise with no media behaves exactly as it does today. Safe to apply to
-- a populated production table.
--
-- media_path  — SAME-ORIGIN path, e.g. '/exercises/Barbell_Bench_Press.jpg'.
--               The app's CSP blocks external hosts (D27), so media is
--               vendored into `public/exercises/` and served from the app's own
--               origin; no CDN, no Supabase Storage URL. Swapping in one of
--               Marcus's own filmed clips later = drop the file into
--               public/exercises/ and update this row's path + type. No schema
--               or code change per exercise.
-- media_type  — 'image' | 'gif' | 'video'. Drives which element the (future)
--               UI renders. CHECK-constrained rather than an enum so adding a
--               kind later is an ALTER CONSTRAINT, not a type migration.
-- source_slug — the free-exercise-db catalog id (e.g. 'Barbell_Bench_Press')
--               this row was enriched from. Kept so a later catalog refresh can
--               RE-MATCH deterministically instead of re-running the fuzzy
--               name match, and so a media file can be traced to its source.
--               NOT a foreign key: the catalog is a vendored JSON file
--               (public domain / Unlicense, D26), not a table.

ALTER TABLE exercises
ADD COLUMN media_path text,
ADD COLUMN media_type text,
ADD COLUMN source_slug text;

-- media_type is only meaningful alongside a path, and must name a kind the UI
-- can render. NULL passes (that is the no-media state) — the constraint only
-- binds rows that actually claim a type.
ALTER TABLE exercises
ADD CONSTRAINT exercises_media_type_valid CHECK (
  media_type IS NULL OR media_type IN ('image', 'gif', 'video')
);

COMMENT ON COLUMN exercises.media_path IS
  'Same-origin path to this exercise''s media, e.g. /exercises/<slug>.jpg (D27). NULL = no media.';
COMMENT ON COLUMN exercises.media_type IS
  'image | gif | video — which element renders media_path. NULL = no media.';
COMMENT ON COLUMN exercises.source_slug IS
  'free-exercise-db catalog id this row was enriched from (D26); enables deterministic re-matching.';
