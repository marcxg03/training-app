// Fixture tests for ExerciseImage's three media models (T2-F). Run with:
//   pnpm exec tsx scripts/verify-exercise-image.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS
//   T2-F gave `media_type` a fourth value, 'figure-sequence', whose
//   `media_path` is a DIRECTORY rather than a file. That is a real trap: the
//   T2-B code path would have rendered <img src="/exercises/figures/dip">
//   — a directory URL — as a broken image, and because the old guard only
//   checked `media_type !== "image" && !== "gif"`, an unrecognised type used
//   to disappear silently. So the assertions below pin, for every model:
//     - which element comes out (a 3-frame stack vs a single <img>)
//     - that the frame URLs are built as <dir>/frame-N.png, once each
//     - that NO media and an UNKNOWN type both degrade to null rather than
//       an empty box or a broken image
//     - that the accessible name lands once on the stack, not three times
//
// Gotcha (load-bearing, same as verify-charts.ts): Next's tsconfig uses
// jsx:preserve, so tsx compiles components to classic React.createElement —
// React must be on globalThis and this script builds elements without JSX.
import * as React from "react";
(globalThis as Record<string, unknown>).React = React;

import { renderToStaticMarkup } from "react-dom/server";

import {
  ExerciseImage,
  type ExerciseImageProps,
} from "../src/components/shared/ExerciseImage";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures += 1;
    console.error(
      `✗ ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(`✓ ${name}`);
  }
}

function render(props: ExerciseImageProps): string {
  const element = ExerciseImage(props);
  return element === null ? "" : renderToStaticMarkup(element);
}

const FIGURE: ExerciseImageProps = {
  mediaPath: "/exercises/figures/weighted-dip",
  mediaType: "figure-sequence",
  name: "Weighted Dips",
  size: "thumb",
};

// --- figure-sequence ----------------------------------------------------
const figure = render(FIGURE);

/** The frame files an <img> actually requests, in document order. */
function frameSrcs(html: string): string[] {
  return [...html.matchAll(/<img[^>]*\ssrc="([^"]*frame-\d\.png)"/g)].map(
    (m) => m[1].split("/").pop() as string,
  );
}

check("figure: emits exactly three frames", frameSrcs(figure).length, 3);
check("figure: frames are numbered 1..3 in order", frameSrcs(figure), [
  "frame-1.png",
  "frame-2.png",
  "frame-3.png",
]);
// React 19 hoists a preload for the eager image. Worth pinning: it is what
// makes the first pose paint without a blank box on a cold logger screen.
check(
  "figure: React preloads the first frame only",
  (figure.match(/<link rel="preload" as="image" href="[^"]*frame-\d\.png"\/>/g) ?? []).length, // prettier-ignore
  1,
);
check(
  "figure: builds <dir>/frame-N.png",
  figure.includes('src="/exercises/figures/weighted-dip/frame-2.png"'),
  true,
);
check("figure: carries the cycling class", figure.includes("figure-seq"), true);
check(
  "figure: each frame is tagged with its index",
  (figure.match(/data-frame="\d"/g) ?? []).sort(),
  ['data-frame="0"', 'data-frame="1"', 'data-frame="2"'],
);
// The stack is one picture of one movement. Three accessible names would make
// a screen reader announce the same exercise three times per row.
check(
  "figure: exactly one accessible name",
  (figure.match(/aria-label="Weighted Dips demonstration"/g) ?? []).length,
  1,
);
check("figure: the stack is the role=img", figure.includes('role="img"'), true);
check(
  "figure: individual frames are hidden from AT",
  (figure.match(/aria-hidden="true"/g) ?? []).length,
  3,
);
// The first pose is what a reduced-motion user sees and what fills the box
// first — lazy-loading it would leave an empty frame on screen.
check(
  "figure: first frame is eager, the rest lazy",
  [
    figure.includes('frame-1.png"'),
    (figure.match(/loading="lazy"/g) ?? []).length,
  ],
  [true, 2],
);

// A trailing slash in the stored path would otherwise produce "dir//frame-1.png".
const trailing = render({ ...FIGURE, mediaPath: "/exercises/figures/dip/" });
check(
  "figure: a trailing slash never doubles",
  trailing.includes("//frame-1.png"),
  false,
);
check(
  "figure: trailing slash still resolves",
  trailing.includes('src="/exercises/figures/dip/frame-1.png"'),
  true,
);

// --- still photo (the T2-B path must not regress) -----------------------
const photo = render({
  mediaPath: "/exercises/Barbell_Bench_Press.jpg",
  mediaType: "image",
  name: "Barbell Bench Press",
  size: "header",
});
check(
  "photo: one img at the stored path",
  photo.includes('src="/exercises/Barbell_Bench_Press.jpg"'),
  true,
);
check("photo: no frame stack", photo.includes("figure-seq"), false);
check(
  "photo: keeps its own accessible name",
  photo.includes('alt="Barbell Bench Press demonstration"'),
  true,
);
check(
  "gif renders through the same path",
  render({
    mediaPath: "/exercises/x.gif",
    mediaType: "gif",
    name: "X",
    size: "thumb",
  }).includes('src="/exercises/x.gif"'),
  true,
);

// --- degradation --------------------------------------------------------
// The majority of the library has no media at all; returning an empty frame
// here would put a grey box in every logger row.
check(
  "no path renders nothing",
  render({ mediaPath: null, mediaType: null, name: "X", size: "thumb" }),
  "",
);
check(
  "path without a type renders nothing",
  render({ mediaPath: "/exercises/x.jpg", mediaType: null, name: "X", size: "thumb" }), // prettier-ignore
  "",
);
// 'video' is allowed by the CHECK constraint but has no element yet; it must
// render nothing rather than a broken <img>.
check(
  "unknown/unsupported type renders nothing",
  render({ mediaPath: "/exercises/x.mp4", mediaType: "video", name: "X", size: "thumb" }), // prettier-ignore
  "",
);

// --- sizing -------------------------------------------------------------
// The box is reserved before the bytes land, or every row jumps on load.
check(
  "thumb reserves a square box for a square figure",
  render({ ...FIGURE, size: "thumb" }).includes("width:56px;height:56px"),
  true,
);
check(
  "header reserves a square box too",
  render({ ...FIGURE, size: "header" }).includes("width:448px;height:448px"),
  true,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll exercise-image checks passed.");
