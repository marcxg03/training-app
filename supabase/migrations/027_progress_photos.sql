-- Progress photos (T2-C, D29): a private, owner-scoped photo timeline that
-- lives in the Progress tab's Body area next to the bodyweight trend.
--
-- Two halves in ONE file, because `supabase db push` runs migrations and
-- nothing else — the Storage bucket and its object policies have to be created
-- by SQL here or they never exist in a fresh environment. Both halves are
-- idempotent (ON CONFLICT / DROP POLICY IF EXISTS), so re-running is safe.
--
-- Shape of a photo:
--   row     progress_photos  — the metadata + the pointer (storage_path)
--   object  storage.objects  — the bytes, in the PRIVATE `progress-photos`
--                              bucket, at '<user_id>/<uuid>.<ext>'
--
-- The user-id path prefix is load-bearing: it is what the storage policies
-- match on, so an object can only ever be read/written/deleted by the user
-- whose folder it sits in. The app builds the same path in
-- src/lib/progress-photos/paths.ts (buildStoragePath) — the two must agree.

-- ────────────────────────────────────────────────────────── 1. the table ──

CREATE TABLE progress_photos (
  photo_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  taken_on      date NOT NULL,
  note          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The timeline query: this user's photos, newest day first. created_at breaks
-- ties within a day (several photos taken on one date).
CREATE INDEX idx_progress_photos_user_taken
  ON progress_photos (user_id, taken_on DESC);

-- One row per stored object — a duplicate pointer would orphan bytes on delete.
CREATE UNIQUE INDEX idx_progress_photos_storage_path
  ON progress_photos (storage_path);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Owner-scoped, same style as bodyweight_logs (021) and the library tables
-- (016). No UPDATE policy: a photo is immutable once taken — the UI offers
-- add and delete only, so granting UPDATE would widen the surface for nothing.
CREATE POLICY "select_own" ON progress_photos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON progress_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own" ON progress_photos
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE progress_photos IS
  'Progress-photo timeline (T2-C/D29). Bytes live in the private `progress-photos` Storage bucket at <user_id>/<uuid>.<ext>; this table is the metadata + pointer.';
COMMENT ON COLUMN progress_photos.storage_path IS
  'Object key inside the `progress-photos` bucket: <user_id>/<uuid>.<ext>. The user-id prefix is what the storage.objects policies authorize on.';

-- ───────────────────────────────────────────────── 2. the Storage bucket ──
-- PRIVATE (public = false): nothing is served without a server-signed URL.
-- file_size_limit is a server-side backstop under the client-side cap in
-- src/lib/progress-photos/paths.ts (MAX_PHOTO_BYTES); allowed_mime_types
-- pins the three formats every browser can both encode (canvas compression)
-- and render (<img>). HEIC is deliberately excluded — iOS converts camera
-- captures to JPEG for web uploads, and Chrome cannot decode HEIC at all.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  false,
  15728640, -- 15 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public            = false,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ──────────────────────────────────────────── 3. Storage object policies ──
-- storage.objects already has RLS enabled on a Supabase project; these add the
-- owner-only rules for THIS bucket and touch no other bucket.
--
-- storage.foldername('<uid>/<uuid>.jpg') -> '{<uid>}', so [1] is the owning
-- user id. Matching on it means a signed URL can only ever be minted for, and
-- an object only ever written/removed under, the caller's own folder.

DROP POLICY IF EXISTS "progress_photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_delete_own" ON storage.objects;

CREATE POLICY "progress_photos_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "progress_photos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "progress_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE policy on storage.objects for this bucket, matching the table: an
-- uploaded photo is never overwritten in place (the app uploads with
-- upsert:false to a fresh uuid every time).
