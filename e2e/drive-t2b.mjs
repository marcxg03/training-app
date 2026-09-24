// T2-B SLICE DRIVE — a real browser, driven as a human would drive it.
//
// T2-B (a) deleted estimated-1RM everywhere, (b) added a per-exercise PR
// history chart (weight PRs blue / left axis, rep PRs violet / right axis), and
// (c) rendered exercises.media_path in the logger's picker and on the exercise
// detail page.
//
// The checks below mirror the six the slice is gated on. Static gates
// (typecheck/lint/build) and the pure-function fixtures have MISSED this class
// of bug twice — a segmented control that never switched, a "control" built
// from <span>s with no handler — so every assertion here is about what a human
// can SEE and CLICK, never about a string existing somewhere in the HTML.
//
// Run:  node e2e/drive-t2b.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally.

import {
  createRun,
  expectAtLeast,
  expectNoText,
  expectNotVisible,
  expectTrue,
  expectVisible,
  findBrokenImages,
  findSvgNaN,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
  visibleText,
} from "./harness/index.mjs";

// Rendered text that must not survive T2-B, in any casing.
const BANNED = ["estimated 1rm", "e1rm"];

// Vendored catalog art that must be served same-origin (migration 026 / D27).
const MEDIA_FILES = [
  "/exercises/Barbell_Bench_Press_-_Medium_Grip.jpg",
  "/exercises/Wide-Grip_Lat_Pulldown.jpg",
  "/exercises/Triceps_Pushdown.jpg",
];

// The logger has no <h1>: single-block focus puts the block label in the top
// bar. The picker's prompt is the page's readiness signal instead — and it
// changes once an exercise is chosen for the block, so match either wording.
const LOGGER_READY = "text=/Which exercise today|Today's exercise/";

// Text unique to exactly one Progress segment. Shared copy ("Strength · PR
// history" renders in BOTH Overview and Trends) is deliberately excluded — a
// marker that appears twice cannot prove a switch happened.
const SEGMENT_MARKERS = {
  Overview: ['h2:text-is("Recent")'],
  Trends: [
    'h2:text-is("Training load · weekly sets")',
    'h2:text-is("Fuel · 30-day trend")',
  ],
  History: ['h2:text-is("All workouts")', 'h2:text-is("Personal records")'],
};

const run = createRun("T2-B drive — e1RM removal · PR chart · exercise media");

let session = null;
let cleanedUp = false;

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, admin, userId, seed, baseUrl } = session;

  // ---------------------------------------------------------------- fixture
  // A logger fixture on TODAY's weekday: the logger refuses to open a workout
  // scheduled for any other day. Built on top of the seeded analytics data so
  // the PR surfaces stay populated.
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

  const { data: exerciseRows } = await admin
    .from("exercises")
    .insert([
      {
        user_id: userId,
        name: "T2B Bench (no media)",
        prescribed_min: 6,
        prescribed_max: 8,
        muscle_groups: ["chest"],
      },
      {
        user_id: userId,
        name: "T2B Pulldown (with media)",
        prescribed_min: 8,
        prescribed_max: 12,
        muscle_groups: ["back"],
        media_path: "/exercises/Wide-Grip_Lat_Pulldown.jpg",
        media_type: "image",
        source_slug: "Wide-Grip_Lat_Pulldown",
      },
    ])
    .select("exercise_id, name");
  const exerciseId = Object.fromEntries(
    exerciseRows.map((row) => [row.name, row.exercise_id]),
  );

  const { data: blockRow } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T2B Chest",
      block_category: "lifting",
      block_type: "failure",
      display_order: 900,
    })
    .select("block_id")
    .single();

  await admin.from("block_lifting_items").insert([
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId["T2B Bench (no media)"],
      display_order: 0,
    },
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId["T2B Pulldown (with media)"],
      display_order: 1,
    },
  ]);

  const { data: planRow } = await admin
    .from("training_plans")
    .insert({ user_id: userId, name: "T2B Drive Plan", is_active: true })
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
      workout_name: "T2B Drive Lift",
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
    `fixture: ${seed.prs} PRs on "${seed.topExerciseName}", logger workout on ${today}`,
  );

  // Clicks a Progress segment and waits for its own marker to paint.
  async function selectSegment(name) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page
      .locator(SEGMENT_MARKERS[name][0])
      .first()
      .waitFor({ state: "visible", timeout: 8000 });
  }

  // =====================================================================
  // CHECK 1 — estimated 1RM is GONE from every rendered surface
  // =====================================================================
  await run.check(
    "1. e1RM gone from /progress (all three segments)",
    async () => {
      await session.go("/progress", "h1");
      const seen = [];

      for (const segment of ["Overview", "Trends", "History"]) {
        await selectSegment(segment);
        for (const banned of BANNED) {
          await expectNoText(page, banned);
        }
        seen.push(`${segment}:clean`);
      }

      return seen.join(" ");
    },
  );

  await run.check("1b. e1RM gone from the exercise detail page", async () => {
    await session.go(`/history/exercises/${seed.topExerciseId}`, "h1");

    for (const banned of BANNED) {
      await expectNoText(page, banned);
    }

    return `${seed.topExerciseName} detail clean`;
  });

  // =====================================================================
  // CHECK 2 — the Progress segmented control actually SWITCHES
  //   Asserted on visibility of each segment's unique content, not on the
  //   active-pill styling. This is the exact regression class that shipped
  //   broken before (Tailwind `hidden` attr vs the `.flex` utility).
  // =====================================================================
  await run.check(
    "2. Progress segments switch (visibility, not styling)",
    async () => {
      await session.go("/progress", "h1");
      const order = ["Overview", "Trends", "History", "Overview"];
      const trail = [];

      for (const active of order) {
        await selectSegment(active);

        for (const [segment, markers] of Object.entries(SEGMENT_MARKERS)) {
          for (const marker of markers) {
            if (segment === active) {
              await expectVisible(page, marker);
            } else {
              await expectNotVisible(page, marker, { timeout: 3000 });
            }
          }
        }

        // The pill must agree with what is actually painted.
        const selected = await page
          .getByRole("tab", { selected: true })
          .innerText();
        expectTrue(
          selected.trim().toLowerCase() === active.toLowerCase(),
          `aria-selected tab is "${selected.trim()}" but "${active}" content is the visible one`,
        );

        trail.push(active);
      }

      await shoot(page, "t2b-progress-overview");
      return trail.join(" → ");
    },
  );

  // =====================================================================
  // CHECK 3 — the PR history chart renders with real data
  //   Navigated the way a human would: Progress → History → click the PR
  //   timeline row for an exercise that has PRs.
  // =====================================================================
  await run.check("3. PR history chart renders with real data", async () => {
    await session.go("/progress?view=history", "h1");
    await expectVisible(page, 'h2:text-is("Personal records")');

    const prLink = page
      .getByRole("link", { name: seed.topExerciseName, exact: true })
      .first();
    await prLink.waitFor({ state: "visible", timeout: 8000 });
    await prLink.click();
    await page.waitForURL(/\/history\/exercises\//, { timeout: 15_000 });

    // The chart itself: role=img svg with the exercise's aria-label.
    const chart = page.locator(
      `svg[aria-label="${seed.topExerciseName} personal-record history"]`,
    );
    await chart.first().waitFor({ state: "visible", timeout: 8000 });

    // Both series present — a path per series (>1 point) plus dots.
    const paths = await chart.locator("path").count();
    const dots = await chart.locator("circle").count();
    expectTrue(
      paths >= 2,
      `expected 2 series lines in the chart svg, found ${paths} <path> elements`,
    );
    expectTrue(dots > 0, `chart svg has no <circle> marks (${dots})`);

    // Legend, from pr-colors.ts — both series named, both axes labelled.
    const text = await visibleText(page);
    for (const label of [
      "Weight PR",
      "Rep PR",
      "LBS",
      "REPS",
      "left ·",
      "right ·",
    ]) {
      expectTrue(
        text.toLowerCase().includes(label.toLowerCase()),
        `legend is missing "${label}" — saw: ${text.slice(0, 260)}`,
      );
    }

    // The dual-axis failure mode: a NaN in a path/coordinate attribute draws
    // NOTHING and reports NO error.
    const bad = await findSvgNaN(page);
    expectTrue(
      bad.length === 0,
      `non-finite values in SVG attributes: ${bad.slice(0, 5).join(" ")}`,
    );

    await shoot(page, "t2b-pr-chart");
    return `${paths} paths, ${dots} dots, 0 NaN`;
  });

  // =====================================================================
  // CHECK 4 — exercise images
  // =====================================================================
  await run.check("4a. no-media exercise degrades gracefully", async () => {
    // Detail page for a seeded exercise with media_path NULL.
    await session.go(`/history/exercises/${seed.topExerciseId}`, "h1");
    const headerImgs = await page.locator("img").count();
    const broken = await findBrokenImages(page);
    expectTrue(
      headerImgs === 0,
      `detail page for a media-less exercise rendered ${headerImgs} <img> element(s) — expected none`,
    );
    expectTrue(broken.length === 0, `broken images: ${broken.join(", ")}`);
    // Page is still intact around the missing image.
    await expectVisible(page, 'h2:text-is("PR history · progression")');
    await expectVisible(page, 'h2:text-is("Recent sets")');

    // Logger picker: the media-less option still renders name + meta.
    // NB: the logger has no <h1> — single-block focus puts the block label in
    // the top bar instead — so the picker's own copy is the readiness signal.
    await session.go(`/log/${workoutRow.workout_id}`, LOGGER_READY);
    await expectVisible(page, "T2B Bench (no media)");
    const pickerBroken = await findBrokenImages(page);
    expectTrue(
      pickerBroken.length === 0,
      `broken images in the picker: ${pickerBroken.join(", ")}`,
    );
    const benchRow = page
      .getByRole("button", { name: /T2B Bench \(no media\)/ })
      .first();
    const benchImgs = await benchRow.locator("img").count();
    expectTrue(
      benchImgs === 0,
      `the media-less picker row rendered ${benchImgs} <img> — expected none (no frame, no placeholder)`,
    );

    await shoot(page, "t2b-logger-picker");
    return "detail + picker render with no image and no broken-image icon";
  });

  await run.check(
    "4b. vendored exercise media is served same-origin",
    async () => {
      const results = [];

      for (const file of MEDIA_FILES) {
        const response = await page.request.get(`${baseUrl}${file}`);
        const type = response.headers()["content-type"] ?? "";
        expectTrue(
          response.status() === 200,
          `GET ${file} returned ${response.status()}`,
        );
        expectTrue(
          type.startsWith("image/"),
          `GET ${file} content-type is "${type}", expected image/*`,
        );
        results.push(`${file.split("/").pop()}=${response.status()}/${type}`);
      }

      return results.join(" ");
    },
  );

  await run.check(
    "4c. an exercise WITH media_path actually renders it",
    async () => {
      // The picker row for the fixture exercise that does have media.
      await session.go(`/log/${workoutRow.workout_id}`, LOGGER_READY);
      const pulldownRow = page
        .getByRole("button", { name: /T2B Pulldown \(with media\)/ })
        .first();
      await pulldownRow.waitFor({ state: "visible", timeout: 8000 });
      const thumb = pulldownRow.locator("img").first();
      await thumb.waitFor({ state: "visible", timeout: 8000 });

      const thumbState = await thumb.evaluate((img) => ({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt"),
        naturalWidth: img.naturalWidth,
        renderedWidth: img.getBoundingClientRect().width,
      }));
      expectTrue(
        thumbState.naturalWidth > 0,
        `picker thumbnail failed to load (naturalWidth=0, src=${thumbState.src})`,
      );
      expectTrue(
        thumbState.src === "/exercises/Wide-Grip_Lat_Pulldown.jpg",
        `picker thumbnail src is "${thumbState.src}"`,
      );

      // The same asset as the detail page header.
      await session.go(
        `/history/exercises/${exerciseId["T2B Pulldown (with media)"]}`,
        "h1",
      );
      const header = page.locator("img").first();
      await header.waitFor({ state: "visible", timeout: 8000 });
      const headerState = await header.evaluate((img) => ({
        naturalWidth: img.naturalWidth,
        renderedWidth: img.getBoundingClientRect().width,
        alt: img.getAttribute("alt"),
      }));
      expectTrue(
        headerState.naturalWidth > 0,
        "detail-page header image failed to load (naturalWidth=0)",
      );
      expectTrue(
        headerState.renderedWidth > 100,
        `detail-page header image rendered only ${headerState.renderedWidth}px wide`,
      );

      await shoot(page, "t2b-exercise-media");
      return `thumb ${thumbState.renderedWidth.toFixed(0)}px · header ${headerState.renderedWidth.toFixed(0)}px · alt "${headerState.alt}"`;
    },
  );

  // =====================================================================
  // CHECK 5 — the logger still works end to end after the picker change
  // =====================================================================
  await run.check(
    "5. logger end-to-end: Today → pick → log a set → reload",
    async () => {
      // Start from Today, as a human does.
      await session.go("/today", "h1");
      const start = page.getByRole("link", { name: /Start Workout/ }).first();
      await start.waitFor({ state: "visible", timeout: 10_000 });
      await start.click();
      await page.waitForURL(/\/log\//, { timeout: 20_000 });
      await expectVisible(page, "Which exercise today?");

      // Pick an exercise from the block's bank.
      await page
        .getByRole("button", { name: /T2B Pulldown \(with media\)/ })
        .first()
        .click();
      await expectVisible(page, "Today's exercise");

      // Log a set: type a weight and reps, submit.
      await page.getByLabel("Weight in pounds").first().fill("135");
      await page.getByLabel("Reps", { exact: true }).first().fill("9");
      await page.getByRole("button", { name: /^Log / }).first().click();

      // The logged row must appear without a reload.
      await expectVisible(page, "135 lbs × 9", { timeout: 15_000 });

      // …and survive one.
      await page.reload({ waitUntil: "networkidle" });
      await expectVisible(page, "Today's exercise", { timeout: 15_000 });
      await expectVisible(page, "135 lbs × 9", { timeout: 15_000 });

      // Confirm at the source of truth too.
      const { data: rows } = await admin
        .from("set_logs")
        .select("reps, weight_kg, exercise_id")
        .eq("user_id", userId)
        .eq("workout_id", workoutRow.workout_id);
      expectTrue(
        (rows ?? []).some(
          (row) =>
            row.reps === 9 &&
            row.exercise_id === exerciseId["T2B Pulldown (with media)"],
        ),
        `set_logs for this workout: ${JSON.stringify(rows)}`,
      );

      await shoot(page, "t2b-logger-logged");
      return `135 lbs × 9 persisted (${(rows ?? []).length} row(s))`;
    },
  );

  // =====================================================================
  // DESKTOP PASS — the same visual mechanisms at 1280x900
  // =====================================================================
  await run.check(
    "6. desktop 1280x900: segments + PR chart hold up",
    async () => {
      await session.setViewport("desktop");
      await session.go("/progress", "h1");

      await selectSegment("Trends");
      await expectVisible(page, 'h2:text-is("Training load · weekly sets")');
      await expectNotVisible(page, 'h2:text-is("All workouts")', {
        timeout: 3000,
      });
      for (const banned of BANNED) {
        await expectNoText(page, banned);
      }
      const bad = await findSvgNaN(page);
      expectTrue(
        bad.length === 0,
        `NaN in SVG on Trends: ${bad.slice(0, 3).join(" ")}`,
      );
      await shoot(page, "t2b-progress-trends");

      await session.go(`/history/exercises/${seed.topExerciseId}`, "h1");
      await expectVisible(
        page,
        `svg[aria-label="${seed.topExerciseName} personal-record history"]`,
      );
      await shoot(page, "t2b-pr-chart-detail");

      await session.go(`/log/${workoutRow.workout_id}`, LOGGER_READY);
      await expectAtLeast(page, "img", 1);
      const broken = await findBrokenImages(page);
      expectTrue(broken.length === 0, `broken images: ${broken.join(", ")}`);
      await shoot(page, "t2b-logger-picker");

      await session.setViewport("mobile");
      return "trends + chart + picker verified at desktop width";
    },
  );
  // =====================================================================
  // CHECK 7 — the chart's FIRST state: one set that earned both PR types
  //   Every newly-PR'd exercise passes through this state, and check 5 just
  //   created one: with a single PR per series both marks land on the SAME
  //   coordinate (x centers with no time span, each y centers in its own
  //   padded one-value axis). That coordinate is the truth and must not be
  //   nudged, so this check does NOT ask the marks to be apart — it asks
  //   whether a human can still see TWO of them there.
  //
  //   The earlier version of this check only asked "distance > 0", which a
  //   single-pixel offset would satisfy while still looking like one dot.
  //   What it measures now, all off the LIVE render (computed style + layout
  //   boxes + hit testing), never off the source:
  //     • one mark per series, each in its own token color
  //     • the two marks are rendered at DIFFERENT sizes (>= 3 CSS px of
  //       diameter apart), so neither can hide the other
  //     • each mark carries a non-zero contrasting halo stroke
  //     • the smaller mark sits INSIDE the larger one, and hit-testing proves
  //       both are actually painted: the center belongs to the inner mark,
  //       every compass point of the ring belongs to the outer one
  // =====================================================================
  await run.check(
    "7. both series are distinguishable when each has one PR",
    async () => {
      await session.go(
        `/history/exercises/${exerciseId["T2B Pulldown (with media)"]}`,
        "h1",
      );
      const chart = page
        .locator(
          'svg[aria-label="T2B Pulldown (with media) personal-record history"]',
        )
        .first();
      await chart.waitFor({ state: "visible", timeout: 8000 });
      await chart.scrollIntoViewIfNeeded();

      const probe = await chart.evaluate((svg) => {
        const circles = [...svg.querySelectorAll("circle")];
        const classOf = (node) => node.getAttribute("class") ?? "";
        const describe = (node) => {
          const box = node.getBoundingClientRect();
          const computed = getComputedStyle(node);

          return {
            cls: classOf(node),
            // The attribute coordinate — is this genuinely the coincident case?
            cx: Number(node.getAttribute("cx")),
            cy: Number(node.getAttribute("cy")),
            // What the browser actually painted, in CSS px.
            diameter: box.width,
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            fill: computed.fill,
            stroke: computed.stroke,
            strokeWidth: Number.parseFloat(computed.strokeWidth) || 0,
          };
        };

        const weight = circles.find((node) =>
          classOf(node).includes("fill-pr-weight"),
        );
        const rep = circles.find((node) =>
          classOf(node).includes("fill-pr-rep"),
        );

        if (!weight || !rep) {
          return {
            count: circles.length,
            classes: circles.map(classOf),
            weight: null,
            rep: null,
          };
        }

        const w = describe(weight);
        const r = describe(rep);
        const inner = w.diameter <= r.diameter ? w : r;
        const outer = inner === w ? r : w;
        // Midway between the two painted edges — inside the outer mark, clear of
        // the inner one and of the inner one's halo.
        const ring = (inner.diameter / 2 + outer.diameter / 2) / 2;
        const at = (x, y) => {
          const el = document.elementFromPoint(x, y);
          return el === null
            ? "none"
            : (el.getAttribute("class") ?? el.tagName);
        };

        return {
          count: circles.length,
          classes: circles.map(classOf),
          weight: w,
          rep: r,
          innerIsRep: inner === r,
          ring,
          hits: {
            center: at(inner.centerX, inner.centerY),
            east: at(outer.centerX + ring, outer.centerY),
            west: at(outer.centerX - ring, outer.centerY),
            north: at(outer.centerX, outer.centerY - ring),
            south: at(outer.centerX, outer.centerY + ring),
          },
        };
      });

      expectTrue(
        probe.count === 2 && probe.weight !== null && probe.rep !== null,
        `expected one mark per series, found ${probe.count}: ${JSON.stringify(probe.classes)}`,
      );

      const { weight, rep, hits, ring } = probe;
      const apart = Math.hypot(
        weight.centerX - rep.centerX,
        weight.centerY - rep.centerY,
      );
      const coincident = apart < 1;

      // This check only means something in the coincident state. Say so loudly
      // if the fixture ever stops producing it, rather than passing vacuously.
      expectTrue(
        coincident,
        `FIXTURE DRIFT: this check exists for the case where both PRs land on ` +
          `ONE coordinate, but the marks rendered ${apart.toFixed(1)}px apart ` +
          `(weight ${weight.cx},${weight.cy} · rep ${rep.cx},${rep.cy}). ` +
          `Re-seed a single set that earns both a weight and a rep PR.`,
      );

      // THE FIX, measured on the render: different sizes at one coordinate.
      const sizeGap = Math.abs(weight.diameter - rep.diameter);
      expectTrue(
        sizeGap >= 3,
        `both marks are drawn at (${weight.cx},${weight.cy}) but their rendered ` +
          `diameters are ${weight.diameter.toFixed(1)}px and ${rep.diameter.toFixed(1)}px ` +
          `— only ${sizeGap.toFixed(1)}px apart, so the mark painted second covers ` +
          `the first and the chart shows ONE dot while the legend promises two series.`,
      );
      expectTrue(
        weight.diameter > rep.diameter,
        `the rep mark (${rep.diameter.toFixed(1)}px) is not smaller than the weight ` +
          `mark (${weight.diameter.toFixed(1)}px) — the inner/outer relationship the ` +
          `paint order depends on has inverted`,
      );
      expectTrue(
        probe.innerIsRep,
        "the smaller (inner) mark is not the rep series — check the paint order",
      );

      // The halo: what keeps the inner mark from merging into the outer fill.
      for (const [name, mark] of [
        ["weight", weight],
        ["rep", rep],
      ]) {
        expectTrue(
          mark.strokeWidth > 0,
          `the ${name} mark renders with stroke-width ${mark.strokeWidth} — no halo, ` +
            `so a mark drawn on top of it merges into one blob`,
        );
        expectTrue(
          mark.stroke !== "none" && mark.stroke !== mark.fill,
          `the ${name} mark's halo (${mark.stroke}) does not contrast with its own ` +
            `fill (${mark.fill})`,
        );
      }

      // Both series are genuinely PAINTED, not just present in the DOM: the
      // center of the stack belongs to the inner mark, the surrounding ring to
      // the outer one. Hit testing goes through the real paint tree.
      expectTrue(
        hits.center.includes("fill-pr-rep"),
        `hit test at the marks' center returned "${hits.center}", expected the rep mark`,
      );
      for (const compass of ["east", "west", "north", "south"]) {
        expectTrue(
          hits[compass].includes("fill-pr-weight"),
          `hit test ${ring.toFixed(1)}px ${compass} of center returned "${hits[compass]}" ` +
            `— the weight mark is not visible as a ring around the rep mark`,
        );
      }

      const bad = await findSvgNaN(page);
      expectTrue(bad.length === 0, `NaN in SVG: ${bad.slice(0, 3).join(" ")}`);

      await shoot(page, "t2b-pr-chart-first-state");

      // A magnified shot of the same chart for the human reviewer — the SVG is
      // vector, so widening its container is a clean zoom, not an upscale. The
      // assertions above are already done; this only changes the picture.
      await session.setViewport("desktop");
      const card = chart.locator("xpath=..");
      await card.evaluate((node) => {
        node.style.width = "1100px";
      });
      await shoot(page, "t2b-pr-chart-first-state-zoom", { of: card });
      await card.evaluate((node) => {
        node.style.width = "";
      });
      await session.setViewport("mobile");

      return (
        `coincident at (${weight.cx},${weight.cy}): weight ${weight.diameter.toFixed(1)}px ` +
        `vs rep ${rep.diameter.toFixed(1)}px (${sizeGap.toFixed(1)}px apart), ` +
        `halos ${weight.strokeWidth}/${rep.strokeWidth}px, center=rep ring=weight`
      );
    },
  );
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
