// T2-F SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T2-F replaced the stock exercise PHOTOS with animated line figures, because
// Marcus said: "i don't like the photos - to go with the clean aesthetic of my
// app i would rather have animated mannequins or figures that fit my
// aesthetic". The mechanism is three stacked <img> frames cross-faded by a
// pure-CSS step animation, recoloured at display time with `filter:
// invert(1)` (the source art is white-on-transparent, drawn for dark UIs).
//
// Run:  node e2e/drive-t2f.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally.
//
// WHAT THIS DRIVE REFUSES TO DO: trust the markup. Asserting that three <img>
// tags exist proves nothing — the whole mechanism lives in CSS that the
// verify-exercise-image.ts fixtures cannot see. A stylesheet that failed to
// load, a keyframe name collision, a `filter` typo or an animation that never
// advances all produce perfect HTML and a broken screen. So every assertion
// below reads COMPUTED STYLE and PAINTED STATE out of the live page:
//   - exactly ONE frame is opaque at any instant (not three stacked)
//   - which frame that is CHANGES over time (the loop actually advances)
//   - the invert filter is really applied (or the figures are invisible on
//     the warm-white background — the exact bug that motivated the recolour)
//   - every frame file actually loads (a directory-path bug 404s silently)
//   - prefers-reduced-motion holds frame 1 and stops the animation
//
// The reduced-motion case gets its OWN browser context, because the media
// query is resolved at context creation and cannot be toggled on a live page.

import {
  createRun,
  expectText,
  expectTrue,
  expectVisible,
  findBrokenImages,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
} from "./harness/index.mjs";

const LOGGER_READY = "text=/Which exercise today|Today's exercise/";
const FRAME_SEL = ".figure-seq__frame";

/** One real catalog figure, vendored by scripts/vendor-figures.ts. */
const FIGURE_PATH = "/exercises/figures/weighted-dip";
const EX_WITH_FIGURE = "T2F Weighted Dips";
const EX_NO_MEDIA = "T2F Unmatched Lift";

const run = createRun("T2-F drive — animated exercise line figures");

let session = null;
let cleanedUp = false;

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, admin, userId, browser, cookies, baseUrl, go } = session;

  // ---------------------------------------------------------------- fixture
  // A logger bank on TODAY's weekday (the logger refuses any other day) with
  // two exercises: one carrying a figure, one carrying NO media at all. The
  // second is the degradation case and it has to be in the same picker as the
  // first, or "nothing rendered" could just mean "the page didn't load".
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  const timeZone = profile?.timezone || "America/Chicago";
  const today = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(new Date())
    .toLowerCase();

  // Exactly one active plan, or Today's `maybeSingle()` schedule lookup throws.
  await admin
    .from("training_plans")
    .update({ is_active: false })
    .eq("user_id", userId);

  const { data: exRows } = await admin
    .from("exercises")
    .insert([
      {
        user_id: userId,
        name: EX_WITH_FIGURE,
        prescribed_min: 6,
        prescribed_max: 10,
        muscle_groups: ["chest"],
        media_path: FIGURE_PATH,
        media_type: "figure-sequence",
        source_slug: "weighted-dip",
      },
      {
        user_id: userId,
        name: EX_NO_MEDIA,
        prescribed_min: 6,
        prescribed_max: 10,
        muscle_groups: ["back"],
      },
    ])
    .select("exercise_id, name");

  expectTrue(
    exRows?.length === 2,
    `fixture insert failed — media_type 'figure-sequence' may be rejected by the CHECK constraint (is migration 028 applied?)`,
  );

  const exerciseId = Object.fromEntries(
    exRows.map((row) => [row.name, row.exercise_id]),
  );

  const { data: blockRow } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T2F Figures",
      block_category: "lifting",
      block_type: "failure",
      display_order: 930,
      warmup_sets: 0,
      working_sets: 1,
      to_failure: false,
    })
    .select("block_id")
    .single();

  await admin.from("block_lifting_items").insert([
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_WITH_FIGURE],
      display_order: 0,
    },
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_NO_MEDIA],
      display_order: 1,
    },
  ]);

  const { data: planRow } = await admin
    .from("training_plans")
    .insert({ user_id: userId, name: "T2F Drive Plan", is_active: true })
    .select("plan_id")
    .single();
  const { data: scheduleRow } = await admin
    .from("daily_schedules")
    .insert({
      plan_id: planRow.plan_id,
      day_of_week: today,
      is_rest_day: false,
    })
    .select("schedule_id")
    .single();
  const { data: workoutRow } = await admin
    .from("workouts")
    .insert({
      schedule_id: scheduleRow.schedule_id,
      workout_type: "lifting",
      workout_name: "T2F Drive Lift",
      timing: "anytime",
      display_order: 0,
    })
    .select("workout_id")
    .single();
  await admin.from("workout_blocks").insert({
    workout_id: workoutRow.workout_id,
    block_id: blockRow.block_id,
    display_order: 0,
  });

  run.section(
    `fixture: logger bank on ${today} — "${EX_WITH_FIGURE}" (figure-sequence) ` +
      `and "${EX_NO_MEDIA}" (no media)`,
  );

  // ── shared probes ────────────────────────────────────────────────────────

  /**
   * What the figure stack is actually PAINTING. Everything here comes from
   * getComputedStyle on the live elements — the point of the drive.
   */
  async function probeFigures(target = page) {
    return target.evaluate((sel) => {
      const frames = [...document.querySelectorAll(sel)];

      return {
        count: frames.length,
        opacities: frames.map((el) =>
          Number(getComputedStyle(el).opacity).toFixed(2),
        ),
        displays: frames.map((el) => getComputedStyle(el).display),
        filters: [...new Set(frames.map((el) => getComputedStyle(el).filter))],
        animationNames: [
          ...new Set(frames.map((el) => getComputedStyle(el).animationName)),
        ],
        srcs: frames.map((el) => el.getAttribute("src")),
        // Which frames are actually contributing paint right now.
        visibleIndexes: frames
          .map((el, i) =>
            getComputedStyle(el).display !== "none" &&
            Number(getComputedStyle(el).opacity) > 0.5
              ? i
              : -1,
          )
          .filter((i) => i >= 0),
      };
    }, FRAME_SEL);
  }

  // ── 1 · the figure renders in the logger picker ──────────────────────────

  await run.check("logger opens with the seeded bank", async () => {
    await go(`/log/${workoutRow.workout_id}`, LOGGER_READY);
    await expectText(page, EX_WITH_FIGURE);
    await expectText(page, EX_NO_MEDIA);
    await shoot(page, "t2f-logger-picker");
    return "both fixture exercises are offered";
  });

  await run.check("three frames are stacked for the figure", async () => {
    const probe = await probeFigures();
    expectTrue(
      probe.count === 3,
      `expected 3 frames in the picker, found ${probe.count}` +
        ` — the no-media exercise must contribute none`,
    );
    expectTrue(
      probe.srcs.every((s, i) => s === `${FIGURE_PATH}/frame-${i + 1}.png`),
      `frame srcs are wrong: ${JSON.stringify(probe.srcs)}`,
    );
    return probe.srcs.map((s) => s.split("/").pop()).join(", ");
  });

  await run.check("every frame file actually loads (no 404)", async () => {
    const broken = await findBrokenImages(page);
    expectTrue(
      broken.length === 0,
      `broken image(s): ${broken.join(", ")} — a directory-path bug 404s silently`,
    );
    return "0 broken images";
  });

  // ── 2 · the CSS mechanism, not the markup ────────────────────────────────

  await run.check("exactly ONE frame is opaque at a time", async () => {
    const probe = await probeFigures();
    expectTrue(
      probe.visibleIndexes.length === 1,
      `expected 1 visible frame, found ${probe.visibleIndexes.length}` +
        ` (opacities ${probe.opacities.join("/")}) — three stacked opaque` +
        ` frames would render as an unreadable overlap`,
    );
    return `frame ${probe.visibleIndexes[0] + 1} is showing`;
  });

  await run.check("the invert recolour is really applied", async () => {
    const probe = await probeFigures();
    expectTrue(
      probe.filters.length === 1 && probe.filters[0].includes("invert"),
      `computed filter is ${JSON.stringify(probe.filters)} — without invert the` +
        ` white-on-transparent art is INVISIBLE on the warm-white background`,
    );
    return probe.filters[0];
  });

  await run.check("the animation is running, not merely declared", async () => {
    const probe = await probeFigures();
    expectTrue(
      probe.animationNames.length === 1 &&
        probe.animationNames[0].includes("figure-seq-cycle"),
      `animation-name is ${JSON.stringify(probe.animationNames)} — a renamed or` +
        ` missing keyframe leaves the stack frozen on frame 1`,
    );
    return probe.animationNames[0];
  });

  await run.check("the loop actually advances over time", async () => {
    // The cycle is 2.4s / 3 frames = 0.8s per frame. Sampling across ~1.8s has
    // to catch at least two different frames, or the animation is stuck.
    const seen = new Set();

    for (let i = 0; i < 7; i++) {
      const probe = await probeFigures();
      if (probe.visibleIndexes.length === 1) {
        seen.add(probe.visibleIndexes[0]);
      }
      await page.waitForTimeout(300);
    }

    expectTrue(
      seen.size >= 2,
      `only frame(s) ${[...seen].join(",")} ever showed across ~2.1s —` +
        ` the sequence is not cycling`,
    );
    return `saw frames ${[...seen]
      .sort()
      .map((i) => i + 1)
      .join(" → ")}`;
  });

  // ── 3 · degradation ──────────────────────────────────────────────────────

  await run.check("an exercise with no media renders no figure", async () => {
    const boxes = await page.evaluate(() => {
      const isPainted = (n) => n.getClientRects().length > 0;
      return [...document.querySelectorAll(".figure-seq")].filter(isPainted)
        .length;
    });
    expectTrue(
      boxes === 1,
      `expected exactly 1 figure box (only the media-carrying exercise), found ${boxes}` +
        ` — a no-media exercise must render nothing, not an empty frame`,
    );
    return "no-media exercise degrades to nothing";
  });

  // ── 3b · the OTHER call site: the full-width header on exercise detail ───

  await run.check("the exercise detail header renders the figure", async () => {
    // ExerciseImage has exactly two call sites — the picker thumb (56px,
    // covered above) and this header (448px). They take different branches of
    // the SIZES table, so a size-specific bug (a box reserved at the photo's
    // 3:2 aspect, say) would slip past a picker-only drive.
    await go(
      `/history/exercises/${exerciseId[EX_WITH_FIGURE]}`,
      `text=${EX_WITH_FIGURE}`,
    );

    const header = await page.evaluate(() => {
      const box = document.querySelector(".figure-seq");
      if (!box) return null;
      const rect = box.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    });

    expectTrue(header !== null, "no figure rendered on the exercise detail");
    // Square art in a square box: a photo-shaped box would letterbox it.
    expectTrue(
      Math.abs(header.w - header.h) <= 1,
      `header box is ${header.w}×${header.h}, not square — the figure is being letterboxed`,
    );
    expectTrue(
      header.w > 200,
      `header figure is only ${header.w}px wide — it is rendering at thumb size`,
    );

    const broken = await findBrokenImages(page);
    expectTrue(broken.length === 0, `broken image(s): ${broken.join(", ")}`);

    await shoot(page, "t2f-exercise-detail");
    return `${header.w}×${header.h} square, frames load`;
  });

  // ── 4 · attribution (a CC BY-SA obligation, not decoration) ──────────────

  await run.check("Settings carries the artwork credit + licence", async () => {
    await go("/settings", "text=Credits");
    await expectVisible(page, "text=Credits");
    await expectText(page, "Bryl Lim");
    await expectText(page, "CC BY-SA 4.0");
    await expectText(page, "Everkinetic");

    const licenceHref = await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((a) =>
        (a.textContent ?? "").includes("CC BY-SA 4.0"),
      );
      return link?.getAttribute("href") ?? null;
    });
    expectTrue(
      licenceHref === "https://creativecommons.org/licenses/by-sa/4.0/",
      `the licence name must LINK to the licence text; got ${licenceHref}`,
    );

    // "indicate if changes were made" — the recolour is disclosed.
    await expectText(page, "recoloured");
    await shoot(page, "t2f-settings-credits");
    return "creator · source · licence link · changes noted";
  });

  // ── 5 · no horizontal overflow at phone width ────────────────────────────

  await run.check("no horizontal overflow at 390px", async () => {
    await go(`/log/${workoutRow.workout_id}`, LOGGER_READY);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expectTrue(
      overflow <= 0,
      `page scrolls ${overflow}px horizontally — the 512px-wide frames are not being boxed`,
    );
    return "0px";
  });

  // ── 6 · prefers-reduced-motion, in its own context ───────────────────────

  await run.check("reduced motion holds the first pose", async () => {
    const rmContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "light",
      reducedMotion: "reduce",
    });

    try {
      await rmContext.addCookies(
        cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
      );
      const rmPage = await rmContext.newPage();
      await rmPage.goto(`${baseUrl}/log/${workoutRow.workout_id}`, {
        waitUntil: "networkidle",
      });
      await rmPage
        .locator(LOGGER_READY)
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });

      const probe = await probeFigures(rmPage);

      expectTrue(
        probe.animationNames.every((n) => n === "none"),
        `animation still running under reduced motion: ${JSON.stringify(probe.animationNames)}`,
      );
      expectTrue(
        probe.visibleIndexes.length === 1 && probe.visibleIndexes[0] === 0,
        `expected only frame 1 painted, got frames ${probe.visibleIndexes.map((i) => i + 1).join(",")}`,
      );
      expectTrue(
        probe.displays.filter((d) => d === "none").length === 2,
        `the other two frames should be display:none, got ${JSON.stringify(probe.displays)}`,
      );
      // Still recoloured — reduced motion must not mean invisible.
      expectTrue(
        probe.filters[0].includes("invert"),
        `the held frame lost its invert filter: ${probe.filters[0]}`,
      );

      await shoot(rmPage, "t2f-reduced-motion");
      return "frame 1 held, animation off, still recoloured";
    } finally {
      await rmContext.close();
    }
  });

  // ── 7 · the real library, not just the fixture ───────────────────────────

  await run.check("the vendored library rows point at real files", async () => {
    // Marcus's OWN rows were re-mediated by scripts/vendor-figures.ts. The
    // fixture above proves the renderer; this proves the DATA — that every
    // figure row's frame-1 is actually on disk and served.
    const { data: rows } = await admin
      .from("exercises")
      .select("name, media_path")
      .eq("media_type", "figure-sequence")
      .limit(400);

    expectTrue(rows?.length > 0, "no figure-sequence rows found at all");

    const misses = [];
    // Sample rather than fetch hundreds: distinct paths only.
    const paths = [...new Set(rows.map((r) => r.media_path))];

    for (const p of paths) {
      const res = await page.request.get(`${baseUrl}${p}/frame-1.png`);
      if (!res.ok()) misses.push(`${p} → ${res.status()}`);
    }

    expectTrue(
      misses.length === 0,
      `${misses.length} figure path(s) 404: ${misses.slice(0, 5).join(", ")}`,
    );
    return `${rows.length} rows over ${paths.length} distinct figures, all served`;
  });
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
