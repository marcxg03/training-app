// T2-D SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T2-D is four fixes Marcus asked for after using the app:
//   1. the one dual-axis PR chart became TWO stacked single-axis charts
//      ("it is confusing looking at it on one graph and the scaling might be
//      off")
//   2. Progress → Trends reordered: Body → Fuel → PR history → Training load
//   3. the logger can be EXITED without being ENDED ("give me the option to
//      exit the workout without ending it")
//   4. a block's chosen exercise can be CHANGED ("allow me to choose a
//      different workout in the block if i accidentally selected one that i do
//      not like")
//
// Run:  node e2e/drive-t2d.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally.
//
// Every assertion here is about what a human can SEE, CLICK, and find in the
// DATABASE afterwards — never about a string existing somewhere in the HTML.
// Two of these fixes are only meaningful against the source of truth (Exit must
// write NOTHING; a post-swap set must be attributed to the NEW exercise), so
// those checks read `workout_completions` / `set_logs` directly.

import {
  createRun,
  expectNoText,
  expectNotVisible,
  expectText,
  expectTrue,
  expectVisible,
  findSvgNaN,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
  visibleText,
} from "./harness/index.mjs";

// The logger has no <h1>: single-block focus puts the block label in the top
// bar. The picker's prompt is the readiness signal, and its copy changes once
// an exercise is chosen (and again mid-swap), so match any of the three.
const LOGGER_READY =
  "text=/Which exercise today|Today's exercise|Change exercise/";

const TRENDS = "/progress?view=trends";

// The order Marcus asked for, top to bottom.
const TRENDS_ORDER = [
  "Body",
  "Fuel · 30-day trend",
  "Strength · PR history",
  "Training load · weekly sets",
];

const EX_A = "T2D Incline Press";
const EX_B = "T2D Cable Fly";
const EX_WEIGHT_ONLY = "T2D Rack Pull (weight PRs only)";

const run = createRun(
  "T2-D drive — two PR charts · Trends order · Exit≠End · swap exercise",
);

let session = null;
let cleanedUp = false;

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, admin, userId, seed } = session;

  // ---------------------------------------------------------------- fixture
  // A logger fixture on TODAY's weekday — the logger refuses to open a workout
  // scheduled for any other day — plus a weight-PRs-only exercise, which is the
  // asymmetric case the two-chart split has to handle honestly.
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
        name: EX_A,
        prescribed_min: 6,
        prescribed_max: 10,
        muscle_groups: ["chest"],
      },
      {
        user_id: userId,
        name: EX_B,
        prescribed_min: 8,
        prescribed_max: 12,
        muscle_groups: ["chest"],
      },
      {
        user_id: userId,
        name: EX_WEIGHT_ONLY,
        prescribed_min: 3,
        prescribed_max: 5,
        muscle_groups: ["back"],
      },
    ])
    .select("exercise_id, name");
  const exerciseId = Object.fromEntries(
    exerciseRows.map((row) => [row.name, row.exercise_id]),
  );

  // warmup_sets 0 / working_sets 1: the very first logged set is a working set,
  // so "Complete block" is offered immediately and nothing auto-completes.
  const { data: blockRow } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T2D Chest",
      block_category: "lifting",
      block_type: "failure",
      display_order: 910,
      warmup_sets: 0,
      working_sets: 1,
      to_failure: false,
    })
    .select("block_id")
    .single();

  await admin.from("block_lifting_items").insert([
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_A],
      display_order: 0,
    },
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_B],
      display_order: 1,
    },
  ]);

  const { data: planRow } = await admin
    .from("training_plans")
    .insert({ user_id: userId, name: "T2D Drive Plan", is_active: true })
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
      workout_name: "T2D Drive Lift",
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

  // --- the weight-PRs-ONLY exercise -----------------------------------------
  // Its own block, deliberately NOT wired into the workout, so its set_logs can
  // never be confused with the logger session's rows. completion_id stays NULL
  // (same trick seed-analytics-data.mjs uses) so the per-session unique index
  // never applies.
  const { data: orphanBlock } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T2D Pull (fixture only)",
      block_category: "lifting",
      block_type: "failure",
      display_order: 911,
    })
    .select("block_id")
    .single();

  const weightOnlySetRows = [0, 1, 2].map((index) => {
    const at = new Date();
    at.setDate(at.getDate() - (21 - index * 7));
    at.setHours(10, 0, 0, 0);

    return {
      user_id: userId,
      workout_id: workoutRow.workout_id,
      block_id: orphanBlock.block_id,
      exercise_id: exerciseId[EX_WEIGHT_ONLY],
      set_index: 9000 + index,
      weight_kg: 100 + index * 10,
      reps: 4,
      prescribed_min: 3,
      prescribed_max: 5,
      logged_at: at.toISOString(),
    };
  });
  const { data: weightOnlySets } = await admin
    .from("set_logs")
    .insert(weightOnlySetRows)
    .select("set_log_id, weight_kg, reps, logged_at");

  // Only 'weight' PRs — the rep count never improves, so this exercise has a
  // populated weight chart and an EMPTY rep chart.
  await admin.from("pr_history").insert(
    weightOnlySets.map((row) => ({
      user_id: userId,
      exercise_id: exerciseId[EX_WEIGHT_ONLY],
      set_log_id: row.set_log_id,
      pr_type: "weight",
      weight_kg: row.weight_kg,
      reps: row.reps,
      achieved_at: row.logged_at,
    })),
  );

  run.section(
    `fixture: ${seed.prs} seeded PRs on "${seed.topExerciseName}" · ` +
      `logger workout on ${today} · a weight-PRs-only exercise`,
  );

  // ── shared probes ────────────────────────────────────────────────────────

  /** Every VISIBLE <h2>, in painted top-to-bottom order. Reads layout, not the
   * source: the three Progress segments all live in the DOM at once and the
   * inactive two are `hidden`, so a source-order read would see every segment's
   * headings and prove nothing about what is on screen. */
  async function visibleH2Order() {
    return page.evaluate(() =>
      [...document.querySelectorAll("h2")]
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => ({
          text: (node.textContent ?? "").trim(),
          y: node.getBoundingClientRect().top + window.scrollY,
        }))
        .sort((a, b) => a.y - b.y)
        .map((entry) => entry.text),
    );
  }

  /** The two PR-chart canvases for one exercise, measured off the live render:
   * mark count, per-mark color, and the vertical spread of each series inside
   * its OWN canvas (which is what "scales independently" means in pixels). */
  async function probeCharts(exerciseName) {
    return page.evaluate((name) => {
      const svgFor = (series) =>
        document.querySelector(
          `svg[aria-label="${name} personal-record history — ${series}"]`,
        );
      const classOf = (node) => node.getAttribute("class") ?? "";
      const describe = (svg) => {
        if (!svg) {
          return null;
        }

        const marks = [...svg.querySelectorAll("circle")].map((node) => ({
          cx: Number(node.getAttribute("cx")),
          cy: Number(node.getAttribute("cy")),
          r: Number(node.getAttribute("r")),
          cls: classOf(node),
        }));
        const cys = marks.map((mark) => mark.cy);
        const box = svg.getBoundingClientRect();

        return {
          marks: marks.length,
          weightMarks: marks.filter((m) => m.cls.includes("fill-pr-weight"))
            .length,
          repMarks: marks.filter((m) => m.cls.includes("fill-pr-rep")).length,
          // viewBox units: usable height is 106 of the 130-unit box.
          span: cys.length > 1 ? Math.max(...cys) - Math.min(...cys) : 0,
          lines: svg.querySelectorAll("path").length,
          top: box.y,
          height: box.height,
        };
      };

      return {
        weight: describe(svgFor("Weight PRs")),
        rep: describe(svgFor("Rep PRs")),
      };
    }, exerciseName);
  }

  /** The logger session's own rows — scoped to the logger block, so the
   * weight-only fixture's set_logs (same workout_id, different block) can never
   * satisfy or break an assertion here. */
  async function sessionSetLogs() {
    const { data } = await admin
      .from("set_logs")
      .select("set_log_id, exercise_id, set_index, weight_kg, reps")
      .eq("user_id", userId)
      .eq("block_id", blockRow.block_id)
      .order("set_index", { ascending: true });

    return data ?? [];
  }

  async function completionRow() {
    const { data } = await admin
      .from("workout_completions")
      .select(
        "completion_id, completed_at, was_ended_early, completed_block_ids",
      )
      .eq("user_id", userId)
      .eq("workout_id", workoutRow.workout_id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data;
  }

  const picker = () => page.locator("div:has(> ul)").first();
  const exerciseOption = (name) =>
    page.getByRole("button", {
      name: new RegExp(name.replace(/[()]/g, "\\$&")),
    });

  // =====================================================================
  // CHECK 1 — Progress → Trends section ORDER
  //   Asserted two independent ways: painted vertical position AND source
  //   order of the visible headings. Presence alone would pass on the OLD
  //   order, which is exactly the bug this check exists to catch.
  // =====================================================================
  await run.check(
    "1. Trends renders Body → Fuel → PR history → Training load",
    async () => {
      await session.go(TRENDS, "h1");
      await expectVisible(page, 'h2:text-is("Body")');

      const painted = await visibleH2Order();
      const positions = TRENDS_ORDER.map((heading) => ({
        heading,
        at: painted.indexOf(heading),
      }));

      for (const { heading, at } of positions) {
        expectTrue(
          at >= 0,
          `"${heading}" is not among the visible headings on Trends: ${JSON.stringify(painted)}`,
        );
        expectTrue(
          painted.filter((text) => text === heading).length === 1,
          `"${heading}" renders ${painted.filter((t) => t === heading).length} times ` +
            `on Trends — an ambiguous marker cannot prove an order`,
        );
      }

      for (let index = 1; index < positions.length; index += 1) {
        expectTrue(
          positions[index - 1].at < positions[index].at,
          `"${positions[index - 1].heading}" must sit ABOVE "${positions[index].heading}" ` +
            `but the painted order is ${JSON.stringify(painted)}`,
        );
      }

      // The same fact, measured through the DOM instead of through layout.
      const domOrdered = await page.evaluate((headings) => {
        const nodes = headings.map((text) =>
          [...document.querySelectorAll("h2")].find(
            (node) =>
              (node.textContent ?? "").trim() === text &&
              node.getClientRects().length > 0,
          ),
        );

        if (nodes.some((node) => !node)) {
          return null;
        }

        return nodes.every(
          (node, index) =>
            index === 0 ||
            nodes[index - 1].compareDocumentPosition(node) &
              Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }, TRENDS_ORDER);
      expectTrue(
        domOrdered === true,
        "the four Trends sections are not in the requested order in the DOM",
      );

      await shoot(page, "t2d-trends-order");
      return painted.join(" → ");
    },
  );

  // =====================================================================
  // CHECK 2 — TWO separate PR charts, each on its own scale
  // =====================================================================
  await run.check(
    "2a. an exercise with both PR types renders TWO charts on independent scales",
    async () => {
      await session.go(`/history/exercises/${seed.topExerciseId}`, "h1");

      const weightSvg = `svg[aria-label="${seed.topExerciseName} personal-record history — Weight PRs"]`;
      const repSvg = `svg[aria-label="${seed.topExerciseName} personal-record history — Rep PRs"]`;
      await expectVisible(page, weightSvg);
      await expectVisible(page, repSvg);

      // Titles and units, one per panel — and NO left/right axis legend, which
      // is the dual-axis artifact this slice removed.
      const text = await visibleText(page);
      for (const label of ["Weight PRs", "Rep PRs", "LBS", "REPS"]) {
        expectTrue(
          text.toLowerCase().includes(label.toLowerCase()),
          `the charts are missing "${label}" — saw: ${text.slice(0, 280)}`,
        );
      }
      await expectNoText(page, "left ·");
      await expectNoText(page, "right ·");

      const probe = await probeCharts(seed.topExerciseName);
      expectTrue(
        probe.weight !== null && probe.rep !== null,
        "one of the two chart canvases is missing",
      );
      expectTrue(
        probe.weight.marks > 0 && probe.rep.marks > 0,
        `expected marks on both charts, got weight=${probe.weight.marks} rep=${probe.rep.marks}`,
      );

      // THE SPLIT ITSELF: neither canvas carries a mark belonging to the other
      // series.
      expectTrue(
        probe.weight.repMarks === 0 && probe.rep.weightMarks === 0,
        `cross-contamination: ${probe.weight.repMarks} rep marks in the weight chart, ` +
          `${probe.rep.weightMarks} weight marks in the rep chart`,
      );

      // INDEPENDENT SCALING, measured rather than asserted from the model: each
      // series fills its own canvas. On one shared axis the rep series (single
      // digits) would be pressed flat against the floor under loads in the
      // hundreds — a span near zero. Usable height is 106 viewBox units.
      expectTrue(
        probe.weight.span >= 53,
        `the weight series spans only ${probe.weight.span.toFixed(1)} of 106 units`,
      );
      expectTrue(
        probe.rep.span >= 53,
        `the rep series spans only ${probe.rep.span.toFixed(1)} of 106 units — ` +
          `it is NOT scaling to its own axis, which is the whole point of the split`,
      );

      // The two canvases are stacked, so no mark can occlude another's.
      expectTrue(
        probe.rep.top >= probe.weight.top + probe.weight.height,
        `the two charts overlap vertically (weight top ${probe.weight.top.toFixed(0)} ` +
          `h ${probe.weight.height.toFixed(0)}, rep top ${probe.rep.top.toFixed(0)})`,
      );

      const bad = await findSvgNaN(page);
      expectTrue(
        bad.length === 0,
        `non-finite values in SVG attributes: ${bad.slice(0, 5).join(" ")}`,
      );

      await shoot(page, "t2d-pr-charts-both");
      await shoot(page, "t2d-pr-charts-closeup", {
        of: page
          .locator("section:has(h2:text-is('PR history · progression'))")
          .first(),
      });

      return (
        `weight: ${probe.weight.marks} marks spanning ${probe.weight.span.toFixed(0)}u · ` +
        `rep: ${probe.rep.marks} marks spanning ${probe.rep.span.toFixed(0)}u · 0 NaN`
      );
    },
  );

  await run.check(
    "2b. a weight-PRs-only exercise: weight chart has data, rep chart reads EMPTY",
    async () => {
      await session.go(
        `/history/exercises/${exerciseId[EX_WEIGHT_ONLY]}`,
        "h1",
      );

      const probe = await probeCharts(EX_WEIGHT_ONLY);
      expectTrue(
        probe.weight !== null,
        "the weight chart did not render for a weight-only exercise",
      );
      expectTrue(
        probe.weight.marks === 3 && probe.weight.repMarks === 0,
        `expected 3 weight marks and no rep marks, got ${JSON.stringify(probe.weight)}`,
      );
      expectTrue(
        probe.weight.span >= 53,
        `the weight series spans only ${probe.weight.span.toFixed(1)} of 106 units`,
      );

      // The rep PANEL still renders — it just has no canvas. A chart that
      // vanished entirely would read as a bug; the empty state answers the
      // question "where are my rep PRs?".
      expectTrue(
        probe.rep === null,
        "the rep chart drew a canvas for an exercise with no rep PRs",
      );
      await expectVisible(page, 'text="Rep PRs"');
      await expectText(page, "No rep PRs yet");
      await expectNoText(page, "No weight PRs yet");

      const bad = await findSvgNaN(page);
      expectTrue(bad.length === 0, `NaN in SVG: ${bad.slice(0, 5).join(" ")}`);

      await shoot(page, "t2d-pr-charts-weight-only");
      return "weight chart populated (3 marks), rep chart shows its own empty state";
    },
  );

  // =====================================================================
  // CHECK 3 — SWAP the block's exercise
  //   Run FIRST of the logger checks because it needs a block with nothing
  //   logged yet — the "oops, wrong tap" case.
  // =====================================================================
  await run.check(
    "3. swap the block's exercise before any set is logged, then log against the NEW one",
    async () => {
      await session.go("/today", "h1");
      const start = page.getByRole("link", { name: /Start Workout/ }).first();
      await start.waitFor({ state: "visible", timeout: 10_000 });
      await start.click();
      await page.waitForURL(/\/log\//, { timeout: 20_000 });
      await expectVisible(page, "Which exercise today?");

      // Both bank options are offered before a choice is made.
      await expectVisible(page, EX_A);
      await expectVisible(page, EX_B);
      await shoot(page, "t2d-logger-picker-open");

      // The wrong tap.
      await exerciseOption(EX_A).first().click();
      await expectVisible(page, "Today's exercise");
      await expectVisible(page, EX_A);
      await expectNotVisible(page, EX_B, { timeout: 3000 });

      // The fix: change it.
      const changeButton = page.getByRole("button", {
        name: /Change exercise/,
      });
      await expectVisible(page, changeButton);
      await changeButton.click();
      await expectVisible(page, EX_B);
      await shoot(page, "t2d-logger-swap-open");

      await exerciseOption(EX_B).first().click();

      // No confirm is asked for with nothing logged — and the picker now shows
      // B and only B.
      await expectVisible(page, "Today's exercise");
      await expectVisible(page, EX_B);
      await expectNotVisible(page, EX_A, { timeout: 3000 });
      expectTrue(
        (await page.getByRole("dialog").count()) === 0,
        "a confirm dialog appeared for a swap with zero logged sets",
      );

      // The set logged AFTER the swap must belong to B in the database.
      await page.getByLabel("Weight in pounds").first().fill("145");
      await page.getByLabel("Reps", { exact: true }).first().fill("10");
      await page.getByRole("button", { name: /^Log / }).first().click();
      await expectVisible(page, "145 lbs × 10", { timeout: 15_000 });

      const rows = await sessionSetLogs();
      expectTrue(
        rows.length === 1,
        `expected exactly 1 set_log for this block, found ${rows.length}`,
      );
      expectTrue(
        rows[0].exercise_id === exerciseId[EX_B],
        `the set was attributed to ${rows[0].exercise_id}, expected ${EX_B} ` +
          `(${exerciseId[EX_B]}) — the swap did not reach the write`,
      );

      await shoot(page, "t2d-logger-after-swap");
      return `picked ${EX_A} → swapped to ${EX_B} → 145×10 logged under ${EX_B}`;
    },
  );

  await run.check(
    "3b. swapping AFTER sets exist asks first, and cancelling changes nothing",
    async () => {
      await page.getByRole("button", { name: /Change exercise/ }).click();
      await exerciseOption(EX_A).first().click();

      // The confirm has to state plainly where the already-logged sets stay —
      // that honesty is the reason this path is allowed at all.
      const confirm = page.getByRole("dialog");
      await expectVisible(page, confirm);
      const copy = await confirm.innerText();
      expectTrue(
        copy.includes(EX_A) && copy.includes(EX_B),
        `the confirm names neither the old nor the new exercise: ${copy}`,
      );
      expectTrue(
        /stay recorded under/i.test(copy) &&
          /nothing saved is changed or deleted/i.test(copy),
        `the confirm does not say what happens to the logged set: ${copy}`,
      );
      await shoot(page, "t2d-logger-swap-confirm");

      await confirm.getByRole("button", { name: /^Cancel$/ }).click();
      await expectNotVisible(page, confirm, { timeout: 5000 });

      // Cancelled means cancelled: still on B, still one row, still under B.
      await expectVisible(page, EX_B);
      const rows = await sessionSetLogs();
      expectTrue(
        rows.length === 1 && rows[0].exercise_id === exerciseId[EX_B],
        `cancelling the swap changed the data: ${JSON.stringify(rows)}`,
      );

      return "confirm names both exercises + the append-only consequence; Cancel is a no-op";
    },
  );

  // =====================================================================
  // CHECK 4 — EXIT leaves the workout running
  //   The assertion that matters is in the DATABASE: Exit must write NOTHING.
  //   A UI that navigates away while quietly completing the session would pass
  //   every on-screen check.
  // =====================================================================
  await run.check(
    "4. Exit → lands on /today, writes nothing, and the workout is still open",
    async () => {
      // Both ways out are on screen at once, and they are not the same control.
      const exitLink = page.getByRole("link", { name: /Exit/ });
      const endButton = page.getByRole("button", { name: /End workout/ });
      await expectVisible(page, exitLink);
      await expectVisible(page, endButton);
      expectTrue(
        (await exitLink.count()) === 1 && (await endButton.count()) === 1,
        "Exit and End workout are not both present exactly once in the top bar",
      );
      await shoot(page, "t2d-logger-exit-vs-end", {
        of: page.locator("div.rounded-2xl").first(),
      });

      const before = await completionRow();
      expectTrue(
        before !== null && before.completed_at === null,
        `the session should be open before Exit, saw ${JSON.stringify(before)}`,
      );

      await exitLink.click();
      await page.waitForURL(/\/today$/, { timeout: 20_000 });
      await expectVisible(page, "h1");

      // THE POINT: nothing was written.
      const after = await completionRow();
      expectTrue(
        after !== null,
        "the workout_completions row disappeared after Exit",
      );
      expectTrue(
        after.completion_id === before.completion_id,
        `Exit started a NEW completion (${after.completion_id}) instead of leaving ` +
          `${before.completion_id} open`,
      );
      expectTrue(
        after.completed_at === null,
        `Exit wrote completed_at = ${after.completed_at} — it ENDED the workout`,
      );
      expectTrue(
        after.was_ended_early === false,
        `Exit set was_ended_early = ${after.was_ended_early}`,
      );

      const rows = await sessionSetLogs();
      expectTrue(
        rows.length === 1 && rows[0].exercise_id === exerciseId[EX_B],
        `Exit disturbed the logged sets: ${JSON.stringify(rows)}`,
      );

      await shoot(page, "t2d-after-exit-today");
      return `completion ${after.completion_id.slice(0, 8)} still open, completed_at null, 1 set intact`;
    },
  );

  await run.check(
    "4b. re-entering resumes the SAME session: same block, prior set intact",
    async () => {
      await session.go("/today", "h1");
      const start = page.getByRole("link", { name: /Start Workout/ }).first();
      await start.waitFor({ state: "visible", timeout: 10_000 });
      await start.click();
      await page.waitForURL(/\/log\//, { timeout: 20_000 });
      await page
        .locator(LOGGER_READY)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });

      // The block it resumes on (findLastIncompleteBlock) and the exercise it
      // resumes with (the latest logged set) — neither may drift.
      await expectText(page, "Block 1 / 1");
      await expectVisible(page, "Today's exercise");
      await expectVisible(page, EX_B);
      await expectNotVisible(page, EX_A, { timeout: 3000 });

      // The set itself survived the round trip.
      await expectVisible(page, "145 lbs × 10", { timeout: 15_000 });

      // And still exactly one, under B — re-entry created no duplicate.
      const rows = await sessionSetLogs();
      const completion = await completionRow();
      expectTrue(
        rows.length === 1 && rows[0].exercise_id === exerciseId[EX_B],
        `re-entry changed the set_logs: ${JSON.stringify(rows)}`,
      );
      expectTrue(
        completion.completed_at === null,
        "re-entry completed the workout",
      );

      await shoot(page, "t2d-logger-resumed");
      return "resumed on Block 1 / 1 with the swapped exercise and the 145×10 set";
    },
  );

  // =====================================================================
  // CHECK 5 — END still ENDS
  //   The other half of the proof: the same session, the other control, a
  //   genuinely different outcome.
  // =====================================================================
  await run.check(
    "5. ✕ End workout → confirm → completed_at IS written (Exit and End differ)",
    async () => {
      const before = await completionRow();
      expectTrue(
        before.completed_at === null,
        "the session was already ended before check 5 ran",
      );

      await page.getByRole("button", { name: /End workout/ }).click();
      const dialog = page.getByRole("dialog");
      await expectVisible(page, dialog);
      await expectText(page, "End workout early?");
      await dialog.getByRole("button", { name: /End now/ }).click();

      await page.waitForURL(/\/summary/, { timeout: 25_000 });

      // Poll: the redirect fires after the update, but the read is a separate
      // round trip.
      let after = null;
      const deadline = Date.now() + 20_000;
      for (;;) {
        after = await completionRow();

        if (after?.completed_at !== null || Date.now() > deadline) {
          break;
        }

        await page.waitForTimeout(250);
      }

      expectTrue(
        after.completion_id === before.completion_id,
        "End acted on a different completion than the one Exit left open",
      );
      expectTrue(
        after.completed_at !== null,
        "End did NOT write completed_at — End and Exit are now the same thing",
      );
      expectTrue(
        after.was_ended_early === true,
        `End left was_ended_early = ${after.was_ended_early}, expected true`,
      );

      await shoot(page, "t2d-after-end-summary");
      return `same completion: null → ${after.completed_at}, was_ended_early true`;
    },
  );

  // =====================================================================
  // CHECK 6 — desktop pass
  // =====================================================================
  await run.check(
    "6. desktop 1280x900: the order and both charts hold up",
    async () => {
      await session.setViewport("desktop");

      await session.go(TRENDS, "h1");
      const painted = await visibleH2Order();
      const seen = TRENDS_ORDER.map((heading) => painted.indexOf(heading));
      expectTrue(
        seen.every(
          (at, index) => at >= 0 && (index === 0 || seen[index - 1] < at),
        ),
        `Trends order broke at desktop width: ${JSON.stringify(painted)}`,
      );
      await shoot(page, "t2d-trends-order");

      await session.go(`/history/exercises/${seed.topExerciseId}`, "h1");
      const probe = await probeCharts(seed.topExerciseName);
      expectTrue(
        probe.weight?.marks > 0 && probe.rep?.marks > 0,
        "a chart lost its marks at desktop width",
      );
      expectTrue(
        probe.rep.top >= probe.weight.top + probe.weight.height,
        "the two charts overlap at desktop width",
      );
      const bad = await findSvgNaN(page);
      expectTrue(bad.length === 0, `NaN in SVG: ${bad.slice(0, 3).join(" ")}`);
      await shoot(page, "t2d-pr-charts-both");

      await session.setViewport("mobile");
      return "order + both charts verified at 1280x900";
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
