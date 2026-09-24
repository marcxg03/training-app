// T2-C SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T2-C put BODY tracking where the trend already is (D29): a "Body" area in
// Progress → Trends holding (a) the bodyweight quick-log, now able to
// back-date, and (b) a progress-photo timeline with camera-first capture,
// signed-URL thumbnails, and delete.
//
// Run:  node e2e/drive-t2c.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally. Storage objects do NOT
// cascade with the auth user, so this script removes them itself.
//
// ── GATING ───────────────────────────────────────────────────────────────
// The photo half needs migration 027 (the `progress_photos` table) AND the
// private `progress-photos` Storage bucket it creates. This slice is NOT
// allowed to apply either to the live project, and a local Supabase stack
// needs Docker, which this machine does not have. So the drive PROBES for
// both and, when they are absent, records the photo checks as SKIP with the
// reason instead of pretending. It still asserts the degraded path — that
// Progress renders the "apply migration 027" notice rather than 500ing —
// because that is the state a deploy-before-push actually produces.
//
// Once the coordinator has pushed 027, re-run this file unchanged: the probe
// flips and every SKIP becomes a real check.

import { deflateSync } from "node:zlib";

import {
  createRun,
  expectAtLeast,
  expectNotVisible,
  expectText,
  expectTrue,
  expectVisible,
  findBrokenImages,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
  visibleText,
} from "./harness/index.mjs";

const BUCKET = "progress-photos";

// ── a real PNG, built here so the drive has no fixture files ──────────────
// setInputFiles takes a buffer, so the "photo" a human would shoot is
// synthesized rather than committed. Two of them, deliberately:
//   small  — under the 600 KB compress threshold: uploaded byte-for-byte.
//   large  — 2200x1650 of high-entropy noise, so it deflates BIG and forces
//            the client-side canvas downscale path.

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** A width x height 8-bit RGB PNG. `pixel(x, y)` returns [r, g, b]. */
function makePng(width, height, pixel) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const at = rowStart + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// A recognizable "photo": teal→violet gradient with a bright horizontal band,
// so a human looking at the screenshot can tell the thumbnail actually painted
// rather than rendering a grey box.
const SMALL_PNG = makePng(480, 480, (x, y) => {
  if (y > 200 && y < 260) {
    return [250, 204, 21];
  }
  return [
    20 + Math.floor((x / 480) * 100),
    130,
    150 + Math.floor((y / 480) * 90),
  ];
});

// Deterministic pseudo-noise (no Math.random — a drive must be reproducible).
let noiseSeed = 0x2f6e2b1;
function noiseByte() {
  noiseSeed ^= noiseSeed << 13;
  noiseSeed ^= noiseSeed >>> 17;
  noiseSeed ^= noiseSeed << 5;
  return (noiseSeed >>> 0) & 0xff;
}
const LARGE_PNG = makePng(2200, 1650, () => [
  noiseByte(),
  noiseByte(),
  noiseByte(),
]);

const run = createRun(
  "T2-C drive — Body area · bodyweight log · progress photos",
);

let session = null;
let cleanedUp = false;
let storageCleanup = "not attempted";

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, admin, userId } = session;

  // ── probe: is the photo half even installable here? ────────────────────
  const { error: tableError } = await admin
    .from("progress_photos")
    .select("photo_id")
    .limit(1);
  const tableReady = !tableError;

  const { data: buckets } = await admin.storage.listBuckets();
  const bucket = (buckets ?? []).find((entry) => entry.id === BUCKET);
  const bucketReady = Boolean(bucket);
  const photosReady = tableReady && bucketReady;

  run.record(
    "migration 027 present (progress_photos table)",
    tableReady ? "PASS" : "SKIP",
    tableReady
      ? "table readable"
      : `absent (${tableError?.code ?? "?"}) — not applied to the live project by design`,
  );
  run.record(
    `Storage bucket "${BUCKET}" present + private`,
    bucketReady ? (bucket.public ? "FAIL" : "PASS") : "SKIP",
    bucketReady
      ? `public=${bucket.public}`
      : "absent — created by migration 027, not applied here",
  );

  const skipReason =
    "migration 027 + the progress-photos bucket are not applied to the live " +
    "project (forbidden for this slice) and `supabase start` needs Docker, " +
    "which is not installed on this machine";

  // A deep link so a RELOAD lands back on Trends instead of Overview — the
  // persistence assertions below depend on that.
  const TRENDS = "/progress?view=trends";

  // Scoped locators. "Log" and "Delete" are generic words; every one of these
  // is anchored to something unique inside the Body area so a stray match
  // elsewhere on the page cannot satisfy an assertion.
  const weightInput = page.getByLabel("Bodyweight in pounds");
  const weightForm = page
    .locator("form")
    .filter({ has: page.getByLabel("Bodyweight in pounds") });
  const logButton = weightForm.getByRole("button", { name: /^Log$/ });
  const dateToggle = page.getByRole("button", {
    name: "Log this weight for another day",
  });
  const weightDate = page.getByLabel("Date this weight was taken");
  const libraryInput = page.locator(
    'input[aria-label="Choose an existing progress photo"]',
  );
  const cameraInput = page.locator('input[aria-label="Take a progress photo"]');
  const thumbnails = page.getByRole("button", {
    name: /^Open progress photo from /,
  });

  /** The lbs number the Body area shows as "current".
   *
   * Read off the SECTION's innerText, not a single element: the label and the
   * number live in two sibling <p>s (and the unit in a <span> inside the
   * second), so no one element ever contains "Bodyweight 183 lbs" and a
   * `text=` locator for it can never match. This is what a human reads. */
  async function currentWeightReading() {
    const text = await visibleText(
      page,
      "section:has(h3:text-is('Bodyweight'))",
    );
    const match = text.match(/Bodyweight\s+([\d.]+)\s*lbs/i);
    return match ? Number(match[1]) : null;
  }

  /**
   * Wait until the weight form has finished saving.
   *
   * The submit button reads "Saving…" for the WHOLE async transition — the
   * upsert, the profile sync, and the post-save refresh — and the input only
   * clears on success. Asserting (or navigating) before that clears is a race:
   * `page.goto` tears the page down and cancels any request still in flight,
   * so the drive would be measuring its own impatience rather than the app.
   */
  async function waitForWeightSaveSettled(timeout = 30_000) {
    await page.waitForFunction(
      () => {
        const input = document.querySelector(
          'input[aria-label="Bodyweight in pounds"]',
        );
        const button = [...document.querySelectorAll("button")].find((node) =>
          /^(Log|Saving…)$/.test((node.textContent ?? "").trim()),
        );

        return (
          Boolean(input) &&
          input.value === "" &&
          Boolean(button) &&
          (button.textContent ?? "").trim() === "Log"
        );
      },
      undefined,
      { timeout },
    );
  }

  /** Poll the rendered reading until it equals `expected` (the router.refresh
   * round-trip is a server render, so it is not instant). */
  async function waitForWeightReading(expected, timeout = 20_000) {
    const deadline = Date.now() + timeout;
    let seen = null;

    for (;;) {
      seen = await currentWeightReading();

      if (seen === expected) {
        return seen;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `the Body area still reads ${seen} lbs after ${timeout}ms, expected ${expected}`,
        );
      }

      await page.waitForTimeout(250);
    }
  }

  // ───────────────────────────────────────────── 1. the Body area exists
  await run.check(
    "1. Progress → Trends shows a Body area with Weight + Photos",
    async () => {
      await session.go(TRENDS, "h1");
      await expectVisible(page, 'h1:text-is("Progress")');
      // Really on Trends, not Overview.
      await expectVisible(page, 'h2:text-is("Training load · weekly sets")');
      await expectVisible(page, 'h2:text-is("Body")');
      await expectVisible(page, 'h3:text-is("Bodyweight")');
      await expectVisible(page, 'h3:text-is("Photos")');

      // D29's other half: Overview stays a glance — neither control there.
      await page.getByRole("tab", { name: "Overview", exact: true }).click();
      await expectVisible(page, 'h2:text-is("Recent")');
      await expectNotVisible(page, 'h2:text-is("Body")');
      await expectNotVisible(page, "Add photo");
      await page.getByRole("tab", { name: "Trends", exact: true }).click();
      await expectVisible(page, 'h2:text-is("Body")');

      return "Body = Weight + Photos, and Overview has neither";
    },
  );

  // ─────────────────────────────────────────── 2. empty / unavailable state
  await run.check(
    photosReady
      ? "2. photo timeline renders its EMPTY state for a user with no photos"
      : "2. photo timeline degrades calmly when 027 is missing (no 500)",
    async () => {
      await session.go(TRENDS, "h1");

      if (photosReady) {
        await expectText(page, "No progress photos yet");
        await expectVisible(page, "Add photo");
        await expectVisible(page, "Choose an existing photo");
        await shoot(page, "t2c-photos-empty");
        return "calm empty state, capture controls still offered";
      }

      // The deploy-before-migration window: a named, actionable notice — and
      // crucially the page still renders (session.go throws on a >=500).
      await expectText(page, "Progress photos need database migration 027");
      await shoot(page, "t2c-photos-unavailable");
      return "migration-027 notice; Progress still renders";
    },
  );

  // ──────────────────────────────────────────── 3. log a bodyweight, reload
  const TODAY_LBS = 183.4;

  await run.check(
    "3. log a bodyweight → chart updates → survives a reload → row in the DB",
    async () => {
      await session.go(TRENDS, "h1");

      const before = await currentWeightReading();
      expectTrue(
        before === null,
        `the throwaway user should start with no bodyweight logs, saw ${before}`,
      );
      await expectText(page, "No data yet");

      await weightInput.fill(String(TODAY_LBS));
      await logButton.click();
      await waitForWeightSaveSettled();

      // The readout is rounded lbs off the kg round-trip.
      const expected = Math.round(TODAY_LBS);
      await waitForWeightReading(expected);

      // The chart is now a real series, not the empty placeholder.
      await expectVisible(page, 'svg[aria-label="Bodyweight trend"]');
      await shoot(page, "t2c-bodyweight-logged");

      // RELOAD — the whole point. A value that only lives in React state
      // passes every in-page assertion and is gone a second later.
      await session.go(TRENDS, "h1");
      const after = await currentWeightReading();
      expectTrue(
        after === expected,
        `after reload the Body area reads ${after} lbs, expected ${expected}`,
      );

      // And the source of truth: kg in the DB, lbs on screen (D-unit rule).
      const { data: rows } = await admin
        .from("bodyweight_logs")
        .select("log_date, weight_kg")
        .eq("user_id", userId);
      expectTrue(
        (rows ?? []).length === 1,
        `expected exactly 1 bodyweight_logs row, found ${(rows ?? []).length}`,
      );
      const kg = Number(rows[0].weight_kg);
      const expectedKg = TODAY_LBS * 0.45359237;
      expectTrue(
        Math.abs(kg - expectedKg) < 0.01,
        `stored ${kg} kg, expected ~${expectedKg.toFixed(3)} kg — storage must stay kg`,
      );

      return `${TODAY_LBS} lbs in → ${kg} kg stored → ${expected} lbs rendered, after reload`;
    },
  );

  // ────────────────────────── 4. back-date a weight (the new affordance)
  await run.check(
    "4. back-date a weight → its own row, and TODAY stays the current weight",
    async () => {
      await session.go(TRENDS, "h1");

      const { data: profileBefore } = await admin
        .from("profiles")
        .select("bodyweight_kg")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: profileRow } = await admin
        .from("profiles")
        .select("timezone")
        .eq("user_id", userId)
        .maybeSingle();
      const timeZone = profileRow?.timezone || "America/Chicago";
      const todayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const pastKey = new Date(`${todayKey}T12:00:00Z`);
      pastKey.setUTCDate(pastKey.getUTCDate() - 6);
      const backDate = pastKey.toISOString().slice(0, 10);

      await dateToggle.click();
      await expectVisible(page, weightDate);
      await weightInput.fill("171.0");
      await weightDate.fill(backDate);
      await logButton.click();
      // Both writes AND the current-weight re-sync happen inside this one
      // pending state — do not navigate or read the DB until it clears.
      await waitForWeightSaveSettled();

      // Wait on the DB, not a timer: the second row landing is the event.
      let rows = [];
      const deadline = Date.now() + 20_000;
      for (;;) {
        const { data } = await admin
          .from("bodyweight_logs")
          .select("log_date, weight_kg")
          .eq("user_id", userId)
          .order("log_date", { ascending: true });
        rows = data ?? [];

        if (rows.length === 2 || Date.now() > deadline) {
          break;
        }

        await page.waitForTimeout(250);
      }

      expectTrue(
        rows.length === 2,
        `expected 2 bodyweight rows after back-dating, found ${rows.length}`,
      );
      expectTrue(
        rows[0].log_date === backDate,
        `the older row should be dated ${backDate}, saw ${rows[0].log_date}`,
      );

      // THE REGRESSION THIS CHECK EXISTS FOR: logBodyweight points
      // profiles.bodyweight_kg at whatever it just wrote. Back-dating must not
      // make last week's number "current".
      const { data: profileAfter } = await admin
        .from("profiles")
        .select("bodyweight_kg")
        .eq("user_id", userId)
        .maybeSingle();
      const currentKg = Number(profileAfter?.bodyweight_kg);
      const todayKg = TODAY_LBS * 0.45359237;
      expectTrue(
        Math.abs(currentKg - todayKg) < 0.01,
        `profiles.bodyweight_kg is ${currentKg} kg (was ${profileBefore?.bodyweight_kg}) — ` +
          `back-dating overwrote the CURRENT weight, which should still be ~${todayKg.toFixed(3)} kg`,
      );

      // The same invariant as a human sees it: the headline reading is still
      // TODAY's weight, and a two-point series now carries a delta label.
      await session.go(TRENDS, "h1");
      await waitForWeightReading(Math.round(TODAY_LBS));
      const bodyText = await visibleText(
        page,
        "section:has(h3:text-is('Bodyweight'))",
      );
      expectTrue(
        /[+-]\d+\s*lbs/.test(bodyText),
        `no delta label rendered for a two-point series — saw "${bodyText.slice(0, 160)}"`,
      );

      await shoot(page, "t2c-bodyweight-backdated");

      return `row at ${backDate} added; current weight still ${currentKg.toFixed(2)} kg`;
    },
  );

  // ───────────────────────────────────── 5. upload a photo, reload, it loads
  if (!photosReady) {
    run.record(
      "5. upload a progress photo → thumbnail → reload",
      "SKIP",
      skipReason,
    );
    run.record(
      "6. a large photo is downscaled client-side",
      "SKIP",
      skipReason,
    );
    run.record(
      "7. delete a photo → gone from timeline AND from Storage",
      "SKIP",
      skipReason,
    );
  } else {
    await run.check(
      "5. upload a progress photo → thumbnail → reload → the image really loads",
      async () => {
        await session.go(TRENDS, "h1");

        await libraryInput.setInputFiles({
          name: "progress-small.png",
          mimeType: "image/png",
          buffer: SMALL_PNG,
        });

        await expectAtLeast(page, thumbnails, 1, { timeout: 20_000 });
        await shoot(page, "t2c-photo-uploaded");

        // RELOAD — proves the row + object, not React state.
        await session.go(TRENDS, "h1");
        await expectAtLeast(page, thumbnails, 1, { timeout: 20_000 });

        // A signed URL that 403s renders a box with a layout size and NO
        // pixels — the single most likely failure of a private bucket. Only
        // naturalWidth can tell the difference.
        const broken = await findBrokenImages(page);
        expectTrue(
          broken.length === 0,
          `broken <img> after reload: ${broken.slice(0, 2).join(" ")}`,
        );
        const natural = await page
          .locator('img[alt^="Progress photo from"]')
          .first()
          .evaluate((img) => ({
            width: img.naturalWidth,
            src: img.currentSrc || img.src,
          }));
        expectTrue(
          natural.width > 0,
          `the thumbnail decoded to naturalWidth ${natural.width} — the signed URL did not serve bytes`,
        );
        expectTrue(
          /token=/.test(natural.src),
          `the thumbnail src is not a signed URL: ${natural.src.slice(0, 120)}`,
        );

        // Source of truth: one row, one object, path prefixed by the user id.
        const { data: rows } = await admin
          .from("progress_photos")
          .select("photo_id, storage_path, taken_on")
          .eq("user_id", userId);
        expectTrue(
          (rows ?? []).length === 1,
          `expected 1 progress_photos row, found ${(rows ?? []).length}`,
        );
        expectTrue(
          rows[0].storage_path.startsWith(`${userId}/`),
          `storage_path "${rows[0].storage_path}" is not under the user's own folder — ` +
            `migration 027's storage policy authorizes on that first segment`,
        );

        const { data: objects } = await admin.storage
          .from(BUCKET)
          .list(userId, { limit: 100 });
        expectTrue(
          (objects ?? []).length === 1,
          `expected 1 object under ${userId}/, found ${(objects ?? []).length}`,
        );

        return `1 row + 1 object at ${rows[0].storage_path}, thumbnail decoded ${natural.width}px`;
      },
    );

    await run.check(
      "6. a large photo is downscaled client-side before upload",
      async () => {
        await session.go(TRENDS, "h1");

        await cameraInput.setInputFiles({
          name: "progress-large.png",
          mimeType: "image/png",
          buffer: LARGE_PNG,
        });

        await expectAtLeast(page, thumbnails, 2, { timeout: 30_000 });
        await session.go(TRENDS, "h1");
        await expectAtLeast(page, thumbnails, 2, { timeout: 20_000 });

        const { data: objects } = await admin.storage
          .from(BUCKET)
          .list(userId, { limit: 100 });
        const sizes = (objects ?? []).map((o) => o.metadata?.size ?? 0);
        const largest = Math.max(...sizes);
        expectTrue(
          largest < LARGE_PNG.length,
          `the stored object is ${largest} bytes but the source was ${LARGE_PNG.length} — no compression happened`,
        );

        // The downscale, measured on the bytes the server actually serves.
        const widths = await page
          .locator('img[alt^="Progress photo from"]')
          .evaluateAll((imgs) => imgs.map((img) => img.naturalWidth));
        expectTrue(
          widths.every((w) => w > 0),
          `a thumbnail failed to decode: widths ${JSON.stringify(widths)}`,
        );
        expectTrue(
          Math.max(...widths) <= 1600,
          `the stored image is ${Math.max(...widths)}px on its long edge — the 1600px cap did not apply`,
        );

        return `${LARGE_PNG.length}B source → ${largest}B stored, longest edge ${Math.max(...widths)}px`;
      },
    );

    await run.check(
      "7. delete a photo → gone from the timeline AND gone from Storage",
      async () => {
        await session.go(TRENDS, "h1");
        const startCount = await thumbnails.count();
        expectTrue(
          startCount >= 1,
          "nothing to delete — earlier checks failed",
        );

        const { data: before } = await admin.storage
          .from(BUCKET)
          .list(userId, { limit: 100 });
        const beforeNames = new Set((before ?? []).map((o) => o.name));

        await thumbnails.first().click();
        // The lightbox: the full photo, not the thumbnail.
        const lightbox = page.getByRole("dialog");
        await expectVisible(page, lightbox);
        await shoot(page, "t2c-photo-lightbox");

        // Confirm BEFORE deleting — the delete is irreversible.
        await lightbox.getByRole("button", { name: "Delete" }).click();
        const confirm = page
          .getByRole("dialog")
          .filter({ hasText: "Delete photo?" });
        await expectVisible(page, confirm);
        await confirm.getByRole("button", { name: "Delete" }).click();

        await page.waitForFunction(
          (n) =>
            document.querySelectorAll(
              'button[aria-label^="Open progress photo from"]',
            ).length < n,
          startCount,
          { timeout: 20_000 },
        );

        const { data: rows } = await admin
          .from("progress_photos")
          .select("photo_id, storage_path")
          .eq("user_id", userId);
        expectTrue(
          (rows ?? []).length === startCount - 1,
          `expected ${startCount - 1} rows after the delete, found ${(rows ?? []).length}`,
        );

        const { data: after } = await admin.storage
          .from(BUCKET)
          .list(userId, { limit: 100 });
        const afterNames = new Set((after ?? []).map((o) => o.name));
        expectTrue(
          afterNames.size === beforeNames.size - 1,
          `Storage still holds ${afterNames.size} objects, expected ${beforeNames.size - 1} — ` +
            `the row went but the BYTES were orphaned`,
        );
        const stillReferenced = new Set(
          (rows ?? []).map((row) => row.storage_path.split("/")[1]),
        );
        for (const name of afterNames) {
          expectTrue(
            stillReferenced.has(name),
            `object ${name} survives with no row pointing at it`,
          );
        }

        // And it survives a reload as deleted.
        await session.go(TRENDS, "h1");
        const endCount = await thumbnails.count();
        expectTrue(
          endCount === startCount - 1,
          `after reload the timeline shows ${endCount} thumbnails, expected ${startCount - 1}`,
        );

        await shoot(page, "t2c-photo-after-delete");

        return `${startCount} → ${endCount} thumbnails; Storage ${beforeNames.size} → ${afterNames.size} objects`;
      },
    );
  }

  // ───────────────────────────────────────────────── 8. desktop + no NaN
  await run.check("8. desktop 1280x900: the Body area holds up", async () => {
    await session.setViewport("desktop");
    await session.go(TRENDS, "h1");
    await expectVisible(page, 'h2:text-is("Body")');
    await expectVisible(page, 'h3:text-is("Bodyweight")');
    await expectVisible(page, 'h3:text-is("Photos")');
    await expectVisible(page, 'svg[aria-label="Bodyweight trend"]');

    const broken = await findBrokenImages(page);
    expectTrue(
      broken.length === 0,
      `broken images on desktop: ${broken.slice(0, 3).join(" ")}`,
    );

    await shoot(page, "t2c-body-area");
    await session.setViewport("mobile");
    await session.go(TRENDS, "h1");
    await shoot(page, "t2c-body-area");

    // A close-up of just the Body area for the human reviewer: at 390px the
    // full-page shot renders this section about 30px tall in a 3300px image,
    // which is not something anyone can actually judge.
    await shoot(page, "t2c-body-closeup", {
      of: page.locator("section:has(> h2:text-is('Body'))"),
    });

    return "mobile + desktop + a Body close-up captured";
  });

  // ────────────────────────────────────────────── storage cleanup (ours)
  // Deleting the auth user cascades ROWS; Storage objects are not rows.
  try {
    const { data: leftovers } = await admin.storage
      .from(BUCKET)
      .list(userId, { limit: 100 });
    const paths = (leftovers ?? []).map((o) => `${userId}/${o.name}`);
    if (paths.length > 0) {
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      storageCleanup = error
        ? `FAILED to remove ${paths.length} object(s): ${error.message}`
        : `removed ${paths.length} object(s)`;
    } else {
      storageCleanup = photosReady ? "nothing left to remove" : "bucket absent";
    }
  } catch (error) {
    storageCleanup = `errored: ${error?.message ?? error}`;
  }
} catch (error) {
  run.record("DRIVE ABORTED", "FAIL", error?.stack ?? String(error));
} finally {
  if (session) {
    try {
      await session.stop();
      cleanedUp = await session.verifyCleanedUp();
    } catch (error) {
      console.error("cleanup error:", error?.message ?? error);
    }
  }
}

run.record(
  "cleanup: uploaded Storage objects removed",
  storageCleanup.startsWith("FAILED") || storageCleanup.startsWith("errored")
    ? "FAIL"
    : "PASS",
  storageCleanup,
);
run.record(
  "cleanup: throwaway @trainingapp.test user deleted",
  cleanedUp ? "PASS" : "FAIL",
  cleanedUp ? "no residual auth user" : "USER STILL PRESENT — clean up by hand",
);

if (session) {
  printConsoleReport(session.console);
}

console.log("\nSCREENSHOTS");
for (const file of screenshots()) {
  console.log(`  ${file}`);
}

process.exit(run.report());
