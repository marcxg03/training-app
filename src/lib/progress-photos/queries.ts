import {
  PROGRESS_PHOTOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/progress-photos/paths";
import { createClient } from "@/lib/supabase/server";

// Server-side read for the Progress → Body photo timeline.
//
// The bucket is PRIVATE, so a stored path is not a URL. Signing happens HERE,
// in the query layer, under the user's own session — which means the signature
// is only ever minted for rows RLS already let this user read, and the browser
// never holds a service-role key or a bucket-wide token. The URLs expire (see
// SIGNED_URL_TTL_SECONDS); the page is dynamic, so every load re-signs.

export type ProgressPhotoRow = {
  photo_id: string;
  storage_path: string;
  taken_on: string;
  note: string;
  created_at: string;
};

export type ProgressPhoto = ProgressPhotoRow & {
  /** Time-limited signed URL, or null when signing failed (a missing bucket,
   * an object deleted out from under its row). The UI renders a placeholder
   * tile rather than a broken <img>. */
  url: string | null;
};

export type ProgressPhotosResult =
  | { available: true; photos: ProgressPhoto[] }
  | { available: false };

/** How many photos the timeline loads. A cap, not a page: the Body area is a
 * glance surface, and signing N URLs is one round-trip whose cost grows with
 * N. Paging is FUTURE_WORK if Marcus ever passes it. */
export const PROGRESS_PHOTO_LIMIT = 60;

/**
 * This user's photos, newest first, each with a signed URL.
 *
 * Returns `available: false` (instead of throwing) when `progress_photos`
 * doesn't exist yet — same contract as getBodyweightTrend, for the same
 * reason: Progress must not 500 in the window between a deploy and the
 * migration being pushed.
 */
export async function getProgressPhotos(
  limit: number = PROGRESS_PHOTO_LIMIT,
): Promise<ProgressPhotosResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("progress_photos")
    .select("photo_id, storage_path, taken_on, note, created_at")
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // PGRST205 = PostgREST's "table not in the schema cache"; 42P01 is the raw
    // Postgres code, kept as a belt-and-suspenders match (mirrors 021's).
    if (error.code === "PGRST205" || error.code === "42P01") {
      console.error("progress_photos missing — apply migration 027");
      return { available: false };
    }

    throw new Error(`Failed to load progress photos: ${error.message}`);
  }

  const rows = (data ?? []) as ProgressPhotoRow[];

  if (rows.length === 0) {
    return { available: true, photos: [] };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );

  if (signError) {
    // The rows are real even if the bucket is not reachable — render the
    // timeline with placeholder tiles rather than an empty state that reads as
    // "you have no photos".
    console.error(`progress-photo signing failed: ${signError.message}`);

    return {
      available: true,
      photos: rows.map((row) => ({ ...row, url: null })),
    };
  }

  const urlByPath = new Map<string, string>();

  for (const entry of signed ?? []) {
    if (entry.path && entry.signedUrl) {
      urlByPath.set(entry.path, entry.signedUrl);
    }
  }

  return {
    available: true,
    photos: rows.map((row) => ({
      ...row,
      url: urlByPath.get(row.storage_path) ?? null,
    })),
  };
}
