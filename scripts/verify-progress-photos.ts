// Fixture tests for the T2-C pure logic — storage-path building, upload
// validation, signed-URL expiry, timeline date grouping, client-side image
// downscaling, and the bodyweight back-date helper.
//
// Run with:
//   pnpm exec tsx scripts/verify-progress-photos.ts
// Exits non-zero on any failure. No test framework (repo idiom).
//
// WHY these functions are pure and tested here rather than asserted through the
// browser drive: every one of them is a silent-corruption surface.
//   • buildStoragePath decides which user's folder an object lands in — get it
//     wrong and the storage RLS policy (migration 027 matches on the first path
//     segment) either rejects the upload or, worse, authorizes the wrong owner.
//   • the signed-URL TTL is invisible until a thumbnail 403s an hour later.
//   • groupPhotosByMonth does DATE math on 'YYYY-MM-DD' strings. Parsing those
//     through `new Date()` shifts them a day west of UTC, which is exactly the
//     class of bug lib/time/appDay.ts exists to prevent — so it must never
//     touch Date at all, and that is asserted below.
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PROGRESS_PHOTOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  buildStoragePath,
  extensionForPhotoType,
  ownerOfStoragePath,
  validatePhotoFile,
} from "../src/lib/progress-photos/paths";
import {
  groupPhotosByMonth,
  photoDayLabel,
  photoMonthLabel,
} from "../src/lib/progress-photos/timeline";
import {
  MAX_PHOTO_EDGE_PX,
  targetDimensions,
} from "../src/lib/progress-photos/compress";
import { normalizeLogDate } from "../src/lib/bodyweight/log-date";

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

function throws(name: string, body: () => unknown) {
  try {
    body();
  } catch {
    console.log(`✓ ${name}`);
    return;
  }
  failures += 1;
  console.error(`✗ ${name}\n  expected a throw, got a value`);
}

const USER = "04d5d1d4-939a-432f-937e-3f17aad2388a";
const PHOTO = "9f2b7c10-1111-4222-8333-444455556666";

// ───────────────────────────────────────────────────── bucket + constants ──
check("bucket name matches migration 027", PROGRESS_PHOTOS_BUCKET, "progress-photos");
check("signed URLs last one hour", SIGNED_URL_TTL_SECONDS, 3600);
check(
  "the signed-URL TTL is long enough to browse a page but not to bookmark",
  SIGNED_URL_TTL_SECONDS >= 300 && SIGNED_URL_TTL_SECONDS <= 86_400,
  true,
);
// The client cap must sit UNDER the bucket's file_size_limit (15 MB in
// migration 027), so an over-size file is refused with our message rather than
// a raw Storage 413.
check("client-side byte cap is under the bucket's 15 MB limit", MAX_PHOTO_BYTES < 15_728_640, true);
check("client-side byte cap is 10 MB", MAX_PHOTO_BYTES, 10 * 1024 * 1024);

// ─────────────────────────────────────────────────────────── extensions ──
check("accepted types are jpeg/png/webp", Object.keys(ACCEPTED_PHOTO_TYPES).sort(), [
  "image/jpeg",
  "image/png",
  "image/webp",
]);
check("jpeg -> jpg", extensionForPhotoType("image/jpeg"), "jpg");
check("png -> png", extensionForPhotoType("image/png"), "png");
check("webp -> webp", extensionForPhotoType("image/webp"), "webp");
// A browser may hand back a type with parameters or in mixed case.
check("type is matched case-insensitively", extensionForPhotoType("IMAGE/JPEG"), "jpg");
check("codec parameters are stripped", extensionForPhotoType("image/jpeg; charset=binary"), "jpg");
check("heic is NOT accepted (Chrome cannot decode it)", extensionForPhotoType("image/heic"), null);
check("gif is NOT accepted", extensionForPhotoType("image/gif"), null);
check("a non-image is not accepted", extensionForPhotoType("application/pdf"), null);
check("empty string is not accepted", extensionForPhotoType(""), null);

// ─────────────────────────────────────────────────────── path building ──
// The first segment MUST be the user id — migration 027's storage policies
// authorize on (storage.foldername(name))[1].
check(
  "path is <user_id>/<uuid>.<ext>",
  buildStoragePath(USER, PHOTO, "image/jpeg"),
  `${USER}/${PHOTO}.jpg`,
);
check(
  "png keeps its own extension",
  buildStoragePath(USER, PHOTO, "image/png"),
  `${USER}/${PHOTO}.png`,
);
check(
  "the first path segment is the owner",
  buildStoragePath(USER, PHOTO, "image/webp").split("/")[0],
  USER,
);
check("the path has exactly one separator (a flat per-user folder)", buildStoragePath(USER, PHOTO, "image/jpeg").split("/").length, 2);
throws("an unsupported mime type cannot produce a path", () =>
  buildStoragePath(USER, PHOTO, "image/heic"),
);
throws("a blank user id cannot produce a path", () =>
  buildStoragePath("", PHOTO, "image/jpeg"),
);
throws("a blank photo id cannot produce a path", () =>
  buildStoragePath(USER, "", "image/jpeg"),
);
// Path traversal: a caller-supplied id must never be able to climb out of the
// user's folder and land under someone else's prefix.
throws("a user id containing a slash is refused", () =>
  buildStoragePath(`${USER}/..`, PHOTO, "image/jpeg"),
);
throws("a photo id containing a slash is refused", () =>
  buildStoragePath(USER, `../${PHOTO}`, "image/jpeg"),
);

check("ownerOfStoragePath reads the first segment", ownerOfStoragePath(`${USER}/${PHOTO}.jpg`), USER);
check("ownerOfStoragePath on a bare filename is null", ownerOfStoragePath("loose.jpg"), null);
check("ownerOfStoragePath on an empty string is null", ownerOfStoragePath(""), null);
check(
  "a path round-trips to its owner",
  ownerOfStoragePath(buildStoragePath(USER, PHOTO, "image/png")),
  USER,
);

// ─────────────────────────────────────────────────────── file validation ──
check("a normal jpeg passes", validatePhotoFile({ type: "image/jpeg", size: 500_000 }), {
  ok: true,
});
check(
  "a zero-byte file is refused",
  validatePhotoFile({ type: "image/jpeg", size: 0 }).ok,
  false,
);
check(
  "an over-cap file is refused",
  validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }).ok,
  false,
);
check(
  "a file exactly at the cap passes",
  validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES }).ok,
  true,
);
check(
  "a heic file is refused",
  validatePhotoFile({ type: "image/heic", size: 100 }).ok,
  false,
);
// The refusal has to be readable by a human, not a code.
const tooBig = validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 });
check(
  "the over-cap error names the limit in MB",
  !tooBig.ok && /10\s?MB/i.test(tooBig.error),
  true,
);
const wrongType = validatePhotoFile({ type: "image/heic", size: 100 });
check(
  "the wrong-type error names the accepted formats",
  !wrongType.ok && /JPEG/i.test(wrongType.error) && /PNG/i.test(wrongType.error),
  true,
);

// ───────────────────────────────────────────────────────── date grouping ──
// Labels are built from the 'YYYY-MM-DD' string, never parsed through Date —
// `new Date('2026-01-01')` is midnight UTC, which is Dec 31 in Chicago.
check("month label", photoMonthLabel("2026-09"), "SEP 2026");
check("month label — January", photoMonthLabel("2026-01"), "JAN 2026");
check("month label — December", photoMonthLabel("2026-12"), "DEC 2026");
check("day label", photoDayLabel("2026-09-12"), "SEP 12");
check("day label strips the leading zero", photoDayLabel("2026-09-01"), "SEP 1");
check("day label — Jan 1 does not slip to Dec 31", photoDayLabel("2026-01-01"), "JAN 1");
check("day label — Dec 31 does not slip to Jan 1", photoDayLabel("2026-12-31"), "DEC 31");

const photos = [
  { photo_id: "a", taken_on: "2026-08-30", created_at: "2026-08-30T12:00:00Z" },
  { photo_id: "b", taken_on: "2026-09-12", created_at: "2026-09-12T12:00:00Z" },
  { photo_id: "c", taken_on: "2026-09-01", created_at: "2026-09-01T12:00:00Z" },
  { photo_id: "d", taken_on: "2026-09-12", created_at: "2026-09-12T18:00:00Z" },
];

const grouped = groupPhotosByMonth(photos);
check("two months", grouped.length, 2);
check("newest month first", grouped.map((g) => g.key), ["2026-09", "2026-08"]);
check("month labels", grouped.map((g) => g.label), ["SEP 2026", "AUG 2026"]);
check(
  "within a month, newest day first and newest-of-day first",
  grouped[0].photos.map((p) => p.photo_id),
  ["d", "b", "c"],
);
check("the older month keeps its single photo", grouped[1].photos.map((p) => p.photo_id), ["a"]);
check("no photo is dropped", grouped.flatMap((g) => g.photos).length, photos.length);
check("empty input groups to nothing", groupPhotosByMonth([]), []);
check(
  "grouping does not mutate its input",
  photos.map((p) => p.photo_id),
  ["a", "b", "c", "d"],
);
// A year boundary must not collapse two Septembers into one group.
check(
  "same month in different years are different groups",
  groupPhotosByMonth([
    { photo_id: "x", taken_on: "2025-09-05", created_at: "2025-09-05T00:00:00Z" },
    { photo_id: "y", taken_on: "2026-09-05", created_at: "2026-09-05T00:00:00Z" },
  ]).map((g) => g.key),
  ["2026-09", "2025-09"],
);

// ──────────────────────────────────────────────────── image downscaling ──
check("the long-edge cap is 1600px", MAX_PHOTO_EDGE_PX, 1600);
check(
  "an already-small image is left alone",
  targetDimensions(800, 600, MAX_PHOTO_EDGE_PX),
  { width: 800, height: 600 },
);
check(
  "an image exactly at the cap is left alone",
  targetDimensions(1600, 1200, MAX_PHOTO_EDGE_PX),
  { width: 1600, height: 1200 },
);
check(
  "a wide image is capped on its width",
  targetDimensions(4000, 3000, MAX_PHOTO_EDGE_PX),
  { width: 1600, height: 1200 },
);
check(
  "a tall phone photo is capped on its height",
  targetDimensions(3024, 4032, MAX_PHOTO_EDGE_PX),
  { width: 1200, height: 1600 },
);
check(
  "aspect ratio is preserved to within a pixel",
  Math.abs(
    targetDimensions(3024, 4032, MAX_PHOTO_EDGE_PX).width /
      targetDimensions(3024, 4032, MAX_PHOTO_EDGE_PX).height -
      3024 / 4032,
  ) < 0.01,
  true,
);
// A canvas of 0 in either dimension throws in the browser — the floor matters.
check("a sliver never rounds to a zero dimension", targetDimensions(10_000, 3, MAX_PHOTO_EDGE_PX), {
  width: 1600,
  height: 1,
});
check("a degenerate 0x0 falls back to 1x1", targetDimensions(0, 0, MAX_PHOTO_EDGE_PX), {
  width: 1,
  height: 1,
});
check("NaN dimensions fall back to 1x1", targetDimensions(Number.NaN, 100, MAX_PHOTO_EDGE_PX), {
  width: 1,
  height: 1,
});

// ───────────────────────────────────────────── bodyweight back-dating ──
// The Body area's weight control now takes an optional date. Everything the
// user can type there passes through this, and only a valid, non-future
// YYYY-MM-DD reaches logBodyweight (whose signature is unchanged).
const TODAY = "2026-09-24";
check("blank means today", normalizeLogDate("", TODAY), { ok: true, date: TODAY });
check("undefined means today", normalizeLogDate(undefined, TODAY), { ok: true, date: TODAY });
check("whitespace means today", normalizeLogDate("   ", TODAY), { ok: true, date: TODAY });
check("today is accepted", normalizeLogDate(TODAY, TODAY), { ok: true, date: TODAY });
check("a past date is accepted", normalizeLogDate("2026-09-01", TODAY), {
  ok: true,
  date: "2026-09-01",
});
check("tomorrow is refused", normalizeLogDate("2026-09-25", TODAY).ok, false);
check("next year is refused", normalizeLogDate("2027-01-01", TODAY).ok, false);
check("a non-date is refused", normalizeLogDate("not a date", TODAY).ok, false);
check("a US-format date is refused", normalizeLogDate("09/24/2026", TODAY).ok, false);
check("an impossible day is refused", normalizeLogDate("2026-02-30", TODAY).ok, false);
check("month 13 is refused", normalizeLogDate("2026-13-01", TODAY).ok, false);
check("a timestamp is refused (the column is a date)", normalizeLogDate("2026-09-24T10:00:00Z", TODAY).ok, false);
// Comparison must be lexical on the ISO strings — parsing to Date would move
// the boundary by a timezone offset and silently admit "tomorrow".
check(
  "the future check is exact at the boundary",
  [
    normalizeLogDate("2026-12-31", "2027-01-01").ok,
    normalizeLogDate("2027-01-01", "2027-01-01").ok,
    normalizeLogDate("2027-01-02", "2027-01-01").ok,
  ],
  [true, true, false],
);
// Leap day is real in 2028 and not in 2026.
check("2028-02-29 is a real date", normalizeLogDate("2028-02-29", "2028-03-01").ok, true);
check("2026-02-29 is not", normalizeLogDate("2026-02-29", "2026-03-01").ok, false);
const futureError = normalizeLogDate("2026-09-25", TODAY);
check(
  "the future-date error explains itself",
  !futureError.ok && /future/i.test(futureError.error),
  true,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll progress-photo checks passed.");
