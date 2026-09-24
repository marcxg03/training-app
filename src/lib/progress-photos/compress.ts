"use client";

// Client-side downscale for progress photos.
//
// A modern phone camera produces a 3–8 MB, 4000px-wide JPEG. Uploading that
// raw burns the user's data, the bucket's quota, and the time between tapping
// the shutter and seeing the thumbnail — for an image that is never displayed
// wider than a phone screen. So we re-encode to a 1600px long edge at JPEG
// quality 0.82 before the bytes leave the device.
//
// The contract is BEST-EFFORT: if anything in the canvas path fails or the
// result is not actually smaller, the ORIGINAL file is uploaded unchanged.
// Compression must never be the reason a photo fails to save.
//
// `targetDimensions` is pure and lives here (next to the only thing that uses
// it) so scripts/verify-progress-photos.ts can pin the arithmetic — a canvas
// with a zero dimension throws in the browser, and a rounding slip is exactly
// how you get there.

/** Long-edge cap. 1600px is ~2x the widest phone viewport the app targets, so
 * a photo still looks sharp fullscreen on a retina display. */
export const MAX_PHOTO_EDGE_PX = 1600;

/** JPEG quality for the re-encode. 0.82 is the usual knee — visually
 * indistinguishable from source at this size, roughly a quarter of the bytes. */
export const COMPRESSED_QUALITY = 0.82;

/** Below this, compressing costs more than it saves — upload as-is. */
export const COMPRESS_THRESHOLD_BYTES = 600 * 1024;

export type Dimensions = { width: number; height: number };

/**
 * The box `width x height` should be drawn into, capped on its long edge and
 * preserving aspect ratio.
 *
 * Never returns a zero or non-finite dimension: `canvas.width = 0` throws, and
 * a NaN dimension silently produces a blank image. An extreme sliver floors to
 * 1px rather than 0.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_PHOTO_EDGE_PX,
): Dimensions {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 1, height: 1 };
  }

  const longest = Math.max(width, height);

  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = maxEdge / longest;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode the image"));
    };
    image.src = url;
  });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * A downscaled JPEG copy of `file`, or `file` itself when compressing is
 * pointless (already small), impossible (canvas/decode failure), or
 * counter-productive (the re-encode came out bigger).
 *
 * Returns a plain object rather than a File so it works in every browser
 * (Safari < 16 has no File constructor from a Blob) — the Storage upload takes
 * a Blob and an explicit contentType, so a File is never needed.
 */
export async function compressPhoto(
  file: File,
): Promise<{ blob: Blob; type: string; compressed: boolean }> {
  const original = { blob: file as Blob, type: file.type, compressed: false };

  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return original;
  }

  try {
    const image = await loadImage(file);
    const size = targetDimensions(
      image.naturalWidth,
      image.naturalHeight,
      MAX_PHOTO_EDGE_PX,
    );
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return original;
    }

    context.drawImage(image, 0, 0, size.width, size.height);

    const blob = await toBlob(canvas, "image/jpeg", COMPRESSED_QUALITY);

    // A re-encode that grew the file (already-optimized small JPEG, flat PNG)
    // is a loss — keep the original.
    if (!blob || blob.size === 0 || blob.size >= file.size) {
      return original;
    }

    return { blob, type: "image/jpeg", compressed: true };
  } catch {
    return original;
  }
}
