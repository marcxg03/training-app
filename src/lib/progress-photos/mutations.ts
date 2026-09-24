import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  PROGRESS_PHOTOS_BUCKET,
  buildStoragePath,
  ownerOfStoragePath,
  validatePhotoFile,
} from "@/lib/progress-photos/paths";
import type { Database } from "@/lib/supabase/types";

type BrowserClient = SupabaseClient<Database>;

type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

// A progress photo is TWO writes — bytes into Storage, then a row pointing at
// them. Either one can fail, and the two failure modes are not symmetric:
//
//   orphan OBJECT (bytes, no row)  — invisible, costs a few hundred KB, and
//                                    the compensating delete below removes it.
//   orphan ROW    (row, no bytes)  — a permanently broken thumbnail the user
//                                    can see and cannot explain.
//
// So the order is fixed: upload FIRST, insert SECOND, and if the insert fails,
// delete the object we just wrote. The row is never written before the bytes
// exist, so an orphan row is not reachable through this path.

function translateMutationError(error: PostgrestError | null): string {
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return "Progress photos aren't set up yet — apply migration 027 first.";
  }
  if (error?.code === "42501") {
    return "You don't have permission to save this photo. Sign out and back in if it persists.";
  }
  if (error?.code === "23505") {
    return "That photo was already saved — reload and try again.";
  }
  return error?.message ?? "Save failed — please retry.";
}

function translateStorageError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return "Photo storage isn't set up yet — the private progress-photos bucket is missing (migration 027).";
  }
  if (/mime type|not supported/i.test(message)) {
    return "That file type isn't allowed. Use a JPEG, PNG, or WebP photo.";
  }
  if (/maximum allowed size|payload too large|413/i.test(message)) {
    return "That photo is too large to upload.";
  }
  if (/row-level security|unauthorized|not authorized|403/i.test(message)) {
    return "You don't have permission to upload this photo.";
  }
  return `Upload failed — ${message}`;
}

/**
 * Upload the bytes, then record the photo.
 *
 * `file` is a Blob + its type rather than a File so the caller can hand over a
 * canvas-compressed blob (see compress.ts) without reconstructing a File —
 * Storage takes a Blob and an explicit contentType.
 */
export async function uploadProgressPhoto(
  supabase: BrowserClient,
  file: { blob: Blob; type: string; size: number },
  takenOn: string,
  note: string,
): Promise<MutationResult<{ photo_id: string; storage_path: string }>> {
  const valid = validatePhotoFile({ type: file.type, size: file.size });

  if (!valid.ok) {
    return { ok: false, error: valid.error };
  }

  // The user id comes from the session, never from a prop — it is also the
  // storage folder the RLS policy authorizes on.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in — reload and try again." };
  }

  let storagePath: string;

  try {
    storagePath = buildStoragePath(user.id, crypto.randomUUID(), file.type);
  } catch {
    return { ok: false, error: "Use a JPEG, PNG, or WebP photo." };
  }

  const { error: uploadError } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .upload(storagePath, file.blob, {
      contentType: file.type,
      // A fresh uuid every time, so an upsert would only ever mask a bug.
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: translateStorageError(uploadError.message) };
  }

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      taken_on: takenOn,
      note: note.trim(),
    })
    .select("photo_id")
    .single();

  if (error || !data) {
    // Compensating delete: the bytes are already up there, and without the row
    // nothing will ever reference them again.
    await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).remove([storagePath]);

    return { ok: false, error: translateMutationError(error) };
  }

  return {
    ok: true,
    data: { photo_id: data.photo_id, storage_path: storagePath },
  };
}

/**
 * Remove the object, then the row.
 *
 * Object first: if the row went first and the object delete then failed, the
 * bytes would be unreferenced and unreachable forever. This way a half-failure
 * leaves a row whose object is gone — visible, and fixable by retrying the
 * delete (Storage `remove` on a missing key is a no-op, not an error).
 */
export async function deleteProgressPhoto(
  supabase: BrowserClient,
  photoId: string,
  storagePath: string,
): Promise<MutationResult<null>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in — reload and try again." };
  }

  // Defense in depth. RLS is the real enforcement (both on the row and on
  // storage.objects); this just refuses to even attempt a path that isn't
  // ours, so a bug upstream can't turn into a confusing 403 loop.
  if (ownerOfStoragePath(storagePath) !== user.id) {
    return { ok: false, error: "That photo doesn't belong to this account." };
  }

  const { error: storageError } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    return {
      ok: false,
      error: `Couldn't delete the photo — ${storageError.message}`,
    };
  }

  const { error } = await supabase
    .from("progress_photos")
    .delete()
    .eq("photo_id", photoId);

  if (error) {
    return { ok: false, error: translateMutationError(error) };
  }

  return { ok: true, data: null };
}
