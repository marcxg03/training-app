import type { JSX } from "react";

// Renders `exercises.media_path` (T2-B, extended T2-F). Migrations 026/028
// vendored the catalog art into /public/exercises, so every path here is
// SAME-ORIGIN — the CSP blocks external hosts and there is no loader to
// configure (D27).
//
// Two media models, chosen by `media_type`:
//
//   'image' | 'gif'      media_path is a FILE. One <img>, as shipped in T2-B.
//   'figure-sequence'    media_path is a DIRECTORY of frame-N.png. Three
//                        stacked frames cycled by CSS (.figure-seq in
//                        globals.css) into a slow loop of the movement.
//
// Degradation is the whole contract: an exercise with no media returns null
// rather than an empty frame, and the callers reserve no space for it.
// `width`/`height` are stamped on the element so the browser reserves the box
// before the bytes land and the row never jumps. next/image is deliberately
// not used — the repo has no other call site for it, and a static same-origin
// asset needs no optimizer.
//
// This is a SERVER component and must stay one: the sequence animates in pure
// CSS precisely so that a logger screen listing six exercises ships no client
// JS for the figures.

/** The free-exercise-db photo frame (T2-B). */
const PHOTO_WIDTH = 850;
const PHOTO_HEIGHT = 567;
/** The figure catalog's native frame — square (T2-F). */
const FIGURE_WIDTH = 512;
const FIGURE_HEIGHT = 512;
const FRAME_COUNT = 3;

export type ExerciseImageSize = "thumb" | "header";

const SIZES: Record<ExerciseImageSize, { width: number; className: string }> = {
  // Logger picker: big enough to recognize the movement at a glance, small
  // enough that 6 options still fit one screen.
  thumb: {
    width: 56,
    className: "rounded-lg border border-border/70 bg-card-alt",
  },
  // Exercise detail: a full-width illustration under the header.
  header: {
    width: 448,
    className:
      "w-full rounded-[var(--radius)] border border-border bg-card-alt",
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
  if (!mediaPath) {
    return null;
  }

  const spec = SIZES[size];

  // --- animated line figure (T2-F) ---------------------------------------
  if (mediaType === "figure-sequence") {
    const height = Math.round((spec.width / FIGURE_WIDTH) * FIGURE_HEIGHT);
    // A trailing slash in the stored path would produce "dir//frame-1.png",
    // which 404s silently — normalize rather than trusting the writer.
    const base = mediaPath.replace(/\/+$/, "");

    return (
      <div
        className={`figure-seq shrink-0 overflow-hidden ${spec.className}`}
        style={{ width: spec.width, height }}
        // The stack is ONE picture of one movement, so it gets one accessible
        // name; the individual frames below are presentational.
        role="img"
        aria-label={`${name} demonstration`}
      >
        {Array.from({ length: FRAME_COUNT }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            data-frame={i}
            className="figure-seq__frame"
            src={`${base}/frame-${i + 1}.png`}
            alt=""
            aria-hidden="true"
            width={FIGURE_WIDTH}
            height={FIGURE_HEIGHT}
            // The first frame is what a reduced-motion user sees and what
            // fills the box first, so it must not be lazy.
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        ))}
      </div>
    );
  }

  // --- still photo (T2-B) -------------------------------------------------
  // media_type is CHECK-constrained (migrations 026/028). Only the still kinds
  // render through a plain <img>; a future 'video' path gets its own element
  // rather than a silently broken one here.
  if (mediaType !== "image" && mediaType !== "gif") {
    return null;
  }

  const height = Math.round((spec.width / PHOTO_WIDTH) * PHOTO_HEIGHT);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaPath}
      alt={`${name} demonstration`}
      width={spec.width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`${spec.className} shrink-0 object-cover`}
      style={{ aspectRatio: `${PHOTO_WIDTH} / ${PHOTO_HEIGHT}` }}
    />
  );
}
