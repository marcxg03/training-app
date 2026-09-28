// Progress-photo storage identity: which bucket, which object key, what a
// browser is allowed to hand us, and how long a signed URL lives.
//
// Pure and dependency-free so scripts/verify-progress-photos.ts can pin it.
// The object-key shape here is LOAD-BEARING: migration 027's storage policies
// authorize on `(storage.foldername(name))[1] = auth.uid()::text`, so the first
// path segment must be the owning user id and there must be no way for a
// caller-supplied value to climb out of that folder.

export const PROGRESS_PHOTOS_BUCKET = "progress-photos";

/** Upload types we accept, mapped to the extension stored in the object key.
 *
 * Three formats, and only three: each one can be both DECODED by a canvas
 * (so the client-side downscale works) and RENDERED by an <img> in every
 * browser the app runs in. HEIC satisfies neither in Chrome — and iOS already
 * transcodes camera captures to JPEG for web uploads, so nothing is lost.
 * The same list is pinned as the bucket's `allowed_mime_types` in 027. */
export const ACCEPTED_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AcceptedPhotoType = keyof typeof ACCEPTED_PHOTO_TYPES;

/** Client-side byte cap, deliberately UNDER the bucket's 15 MB
 * `file_size_limit` so an over-size file is refused with our own sentence
 * instead of a raw Storage 413. Applied AFTER compression. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Signed-URL lifetime. One hour: long enough to browse the timeline, open a
 * photo, and come back without the thumbnails going stale mid-session; short
 * enough that a URL copied out of devtools is not a durable public link to a
 * private photo. The page is server-rendered per request, so every reload
 * mints fresh URLs. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** A path segment is safe only if it cannot restructure the key: no slash, no
 * traversal, no leading/trailing whitespace, and non-empty. */
function isSafeSegment(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..")
  );
}

/** The stored extension for a browser-reported mime type, or null if we don't
 * accept it. Matched case-insensitively and with any `; parameters` stripped —
 * both are things a real browser hands back. */
export function extensionForPhotoType(mimeType: string): string | null {
  if (typeof mimeType !== "string") {
    return null;
  }

  const normalized = mimeType.split(";")[0].trim().toLowerCase();

  return (
    ACCEPTED_PHOTO_TYPES[normalized as AcceptedPhotoType] ??
    (null as string | null)
  );
}

/**
 * `<user_id>/<uuid>.<ext>` — the one place this key is built.
 *
 * Throws rather than returning a fallback: every caller is about to write
 * bytes somewhere, and a silently-wrong prefix means either an upload the
 * storage policy rejects or (if the prefix were attacker-controlled) an object
 * written under another user's folder. A loud failure at the call site is the
 * only acceptable outcome.
 */
export function buildStoragePath(
  userId: string,
  photoId: string,
  mimeType: string,
): string {
  if (!isSafeSegment(userId)) {
    throw new Error(`Refusing to build a storage path for user id "${userId}"`);
  }

  if (!isSafeSegment(photoId)) {
    throw new Error(
      `Refusing to build a storage path for photo id "${photoId}"`,
    );
  }

  const extension = extensionForPhotoType(mimeType);

  if (!extension) {
    throw new Error(`Unsupported photo type "${mimeType}"`);
  }

  return `${userId}/${photoId}.${extension}`;
}

/** The user id a stored object belongs to, read back out of its key — null if
 * the key is not in the `<user_id>/<file>` shape. Used as a client-side
 * defense-in-depth check before a delete; the real enforcement is RLS. */
export function ownerOfStoragePath(storagePath: string): string | null {
  if (typeof storagePath !== "string") {
    return null;
  }

  const [owner, ...rest] = storagePath.split("/");

  if (!owner || rest.length === 0 || rest.join("/").length === 0) {
    return null;
  }

  return owner;
}

export type PhotoValidation = { ok: true } | { ok: false; error: string };

/** Everything we can know about a picked file before reading a single byte. */
export function validatePhotoFile(file: {
  type: string;
  size: number;
}): PhotoValidation {
  if (!extensionForPhotoType(file.type)) {
    return {
      ok: false,
      error: "Use a JPEG, PNG, or WebP photo.",
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "That file is empty — pick another photo." };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `That photo is too large. Keep it under ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB.`,
    };
  }

  return { ok: true };
}
