import type { JSX } from "react";

// Renders `exercises.media_path` (T2-B). Migration 026 vendored the catalog
// art into /public/exercises, so every path here is SAME-ORIGIN — the CSP
// blocks external hosts and there is no loader to configure (D27).
//
// Degradation is the whole contract: most of the library has media_path NULL,
// so this returns null rather than an empty frame, and the callers reserve no
// space for it. `width`/`height` are stamped on the element so the browser
// reserves the box before the bytes land and the row never jumps. next/image
// is deliberately not used — the repo has no other call site for it, and a
// static same-origin JPG needs no optimizer.

// The free-exercise-db catalog's native frame. Pinned so the reserved box
// always matches the file and the row never reflows when the bytes land.
const IMAGE_WIDTH = 850;
const IMAGE_HEIGHT = 567;
const IMAGE_ASPECT = IMAGE_WIDTH / IMAGE_HEIGHT;

export type ExerciseImageSize = "thumb" | "header";

const SIZES: Record<ExerciseImageSize, { width: number; className: string }> = {
  // Logger picker: big enough to recognize the movement at a glance, small
  // enough that 6 options still fit one screen.
  thumb: {
    width: 56,
    className: "rounded-lg border border-border/70 bg-card-alt object-cover",
  },
  // Exercise detail: a full-width illustration under the header.
  header: {
    width: 448,
    className:
      "w-full rounded-[var(--radius)] border border-border bg-card-alt object-cover",
  },
};

export type ExerciseImageProps = {
  mediaPath: string | null;
  mediaType: string | null;
  /** Exercise name — the alt text, so the image is never a mystery to a
   * screen reader or when the file 404s. */
  name: string;
  size: ExerciseImageSize;
};

export function ExerciseImage({
  mediaPath,
  mediaType,
  name,
  size,
}: ExerciseImageProps): JSX.Element | null {
  // media_type is constrained to image | gif | video (migration 026). Only the
  // still kinds render through an <img>; a future video path gets its own
  // element rather than a silently broken one here.
  if (!mediaPath || (mediaType !== "image" && mediaType !== "gif")) {
    return null;
  }

  const spec = SIZES[size];
  const height = Math.round(spec.width / IMAGE_ASPECT);

  // A plain <img>, not next/image: the asset is a static same-origin JPG under
  // /public, next/image has no other call site in this repo, and its optimizer
  // would add a round-trip for no benefit.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaPath}
      alt={`${name} demonstration`}
      width={spec.width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`${spec.className} shrink-0`}
      style={{ aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}` }}
    />
  );
}
