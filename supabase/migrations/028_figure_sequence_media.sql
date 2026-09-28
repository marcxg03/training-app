-- Allow animated line-figure sequences as exercise media (T2-F, D35/D36).
--
-- Migration 026 CHECK-constrained `media_type` to ('image','gif','video')
-- precisely so that adding a kind later would be an ALTER CONSTRAINT rather
-- than an enum migration. This is that ALTER.
--
-- 'figure-sequence' means: `media_path` names a DIRECTORY, not a file, and the
-- frames inside it are `frame-1.png`, `frame-2.png`, … The UI cycles them as a
-- slow loop (and shows frame-1 alone under prefers-reduced-motion). Storing the
-- directory rather than a file list keeps D27's pluggability — swapping one
-- exercise to Marcus's own filmed clip is still "change media_path/media_type
-- on that row", with no schema change and no per-exercise code.
--
-- Deliberately NOT called 'svg-sequence' (the name the T2-F spec first used).
-- The vendored frames are PNG, and naming the media kind after a file format
-- would force another migration the day the frames are redrawn as SVG. The
-- kind describes the PLAYBACK MODEL; the extension is an implementation detail
-- of the directory.
--
-- SAFETY: widening a CHECK can never fail on existing data — every row that
-- satisfied the old predicate satisfies the new one. No column is renamed or
-- dropped, no row changes value, and rows with media_type NULL (the no-media
-- state, still the majority of the library) are unaffected.

ALTER TABLE exercises
DROP CONSTRAINT exercises_media_type_valid;

ALTER TABLE exercises
ADD CONSTRAINT exercises_media_type_valid CHECK (
  media_type IS NULL
  OR media_type IN ('image', 'gif', 'video', 'figure-sequence')
);

COMMENT ON COLUMN exercises.media_type IS
  'image | gif | video | figure-sequence — which element renders media_path. For figure-sequence, media_path is a DIRECTORY holding frame-N.png. NULL = no media.';
COMMENT ON COLUMN exercises.media_path IS
  'Same-origin path to this exercise''s media (D27). A file for image/gif/video, a directory of frame-N.png for figure-sequence. NULL = no media.';
