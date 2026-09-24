// T2-E SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T2-E is two fixes Marcus asked for after using the app:
//   1. Progress → Trends PR history became a SELECTOR over ONE exercise
//      ("maybe we can do a selector to select which exercise to surface and
//      only surface one - so you can select which exercise and see trends").
//      It used to render the top FOUR exercises as four cards of two charts —
//      eight canvases of endless scroll.
//   2. The logger's exercise picker printed junk notes: 39 of his 83 exercises
//      carried "Compound\nCompound\nCompound" (the plan's TYPE column, written
//      into a free-text field and stuttered once per round).
//
// Run:  node e2e/drive-t2e.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally.
//
// WHAT THIS DRIVE REFUSES TO DO: assert that a control's own state changed. The
// selector reporting "E2E Squat" proves nothing about what is painted — that is
// exactly the `hidden`-attribute-vs-`.flex`-utility bug that shipped once. Every
// assertion below reads the CHARTS: how many canvases are visible, whose name is
// on their aria-labels, how many marks they carry, and what range their axis
// headers print.
//
// The notes check is likewise end-to-end: it seeds a genuinely polluted row,
// PROVES the junk renders (a check that cannot fail is not a check), then runs
// the real scripts/clean-exercise-notes.ts against the TEST user only and
// re-reads the picker.

import { execFileSync } from "node:child_process";

import {
  assertTestUser,
  createRun,
  expectNoText,
  expectText,
  expectTrue,
  expectVisible,
  findSvgNaN,
  printConsoleReport,
  REPO_ROOT,
  screenshots,
  shoot,
  startSession,
  visibleText,
} from "./harness/index.mjs";

const TRENDS = "/progress?view=trends";
const PR_HEADING = "Strength · PR history";
const SELECTOR = "#pr-history-exercise";

// The logger has no <h1>: single-block focus puts the block label in the top
// bar. The picker's prompt is the readiness signal, and its copy changes once an
// exercise is chosen, so match either.
const LOGGER_READY = "text=/Which exercise today|Today's exercise/";

// The two notes fixtures, straight out of Marcus's table.
const EX_JUNK = "T2E Lat Pulldown";
const EX_REAL = "T2E Chest Supported Row";
const JUNK_NOTE = "Compound\nCompound\nCompound";
const REAL_NOTE = "Lats / Teres Major";

const run = createRun(
  "T2-E drive — PR-history selector · purge polluted notes",
);

let session = null;
let cleanedUp = false;

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, admin, userId, seed } = session;

  // ---------------------------------------------------------------- fixture
  // A logger fixture on TODAY's weekday — the logger refuses to open a workout
  // scheduled for any other day — whose bank holds one exercise with a polluted
  // note and one with a real note. Neither gets pr_history, so the Trends
  // selector keeps offering exactly the three analytics exercises and the two
  // fixes cannot contaminate each other's assertions.
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

  const { data: noteRows } = await admin
    .from("exercises")
    .insert([
      {
        user_id: userId,
        name: EX_JUNK,
        prescribed_min: 6,
        prescribed_max: 10,
        muscle_groups: ["back"],
        notes: JUNK_NOTE,
      },
      {
        user_id: userId,
        name: EX_REAL,
        prescribed_min: 6,
        prescribed_max: 10,
        muscle_groups: ["back"],
        notes: REAL_NOTE,
      },
    ])
    .select("exercise_id, name");
  const exerciseId = Object.fromEntries(
    noteRows.map((row) => [row.name, row.exercise_id]),
  );

  const { data: blockRow } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T2E Back",
      block_category: "lifting",
      block_type: "failure",
      display_order: 920,
      warmup_sets: 0,
      working_sets: 1,
      to_failure: false,
    })
    .select("block_id")
    .single();

  await admin.from("block_lifting_items").insert([
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_JUNK],
      display_order: 0,
    },
    {
      block_id: blockRow.block_id,
      exercise_id: exerciseId[EX_REAL],
      display_order: 1,
    },
  ]);

  const { data: planRow } = await admin
    .from("training_plans")
    .insert({ user_id: userId, name: "T2E Drive Plan", is_active: true })
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
      workout_name: "T2E Drive Lift",
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
    `fixture: ${seed.prs} seeded PRs across 3 exercises (top: "${seed.topExerciseName}") · ` +
      `logger bank on ${today} carrying one junk note and one real note`,
  );

  // ── shared probes ────────────────────────────────────────────────────────

  /**
   * Everything the PR-history section is actually PAINTING: which exercise's
   * charts, how many canvases, how many marks each carries, and the axis range
   * its panel header prints. Read off the live DOM and filtered by
   * getClientRects() — the three Progress segments all live in the DOM at once
   * and the inactive two are `hidden`, so a source-order read would count
   * Overview's featured chart too and prove nothing about Trends.
   */
  async function probePRSection(heading) {
    return page.evaluate((headingText) => {
      const isPainted = (node) => node.getClientRects().length > 0;
      const headings = [...document.querySelectorAll("h2")].filter(
        (node) => (node.textContent ?? "").trim() === headingText,
      );
      const painted = headings.filter(isPainted);

      if (painted.length !== 1) {
        return {
          error: `expected exactly 1 painted "${headingText}" heading, found ${painted.length} (of ${headings.length} in the DOM)`,
        };
      }

      const section = painted[0].closest("section");

      if (!section) {
        return { error: "the PR-history heading has no enclosing <section>" };
      }

      // Only the chart canvases: PRHistoryChart labels every one of them, and
      // the selector's chevron is an unlabelled decorative <svg>.
      const charts = [
        ...section.querySelectorAll(
          "svg[aria-label*='personal-record history']",
        ),
      ]
        .filter(isPainted)
        .map((svg) => {
          // SeriesChart: <div><PanelHeader/><ChartFrame><svg/><footer/></ChartFrame></div>
          const frame = svg.parentElement;
          const seriesRoot = frame?.parentElement ?? null;
          const header = seriesRoot?.firstElementChild;

          return {
            label: svg.getAttribute("aria-label") ?? "",
            marks: svg.querySelectorAll("circle").length,
            header: (header?.textContent ?? "").replace(/\s+/g, " ").trim(),
            footer: (svg.nextElementSibling?.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),
          };
        });

      const select = section.querySelector("select");

      return {
        charts,
        chartCount: charts.length,
        // Every <svg> inside the section, labelled or not — so a stray canvas
        // cannot hide behind the aria-label filter above.
        allSvgs: [...section.querySelectorAll("svg")].filter(isPainted).length,
        // What the CARD says its exercise is (the headline above the charts),
        // read independently of the aria-labels.
        cardText: (section.textContent ?? "").replace(/\s+/g, " ").trim(),
        select: select
          ? {
              visible: isPainted(select),
              value: select.value,
              selectedLabel: select.options[select.selectedIndex]?.text ?? "",
              options: [...select.options].map((option) => ({
                value: option.value,
                text: option.text,
              })),
            }
          : null,
      };
    }, heading);
  }

  /** The exercise name each chart's aria-label is scoped to — "<name>
   * personal-record history — <series>". One distinct name = one exercise on
   * screen, which is the whole ask. */
  function exerciseNamesOf(probe) {
    return [
      ...new Set(
        probe.charts.map((chart) =>
          chart.label.replace(/ personal-record history.*$/, "").trim(),
        ),
      ),
    ];
  }

  /** Horizontal overflow, measured the way a thumb feels it. */
  async function probeOverflow() {
    return page.evaluate(() => {
      const root = document.documentElement;
      const widest = [...document.querySelectorAll("body *")]
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          cls: (node.getAttribute("class") ?? "").slice(0, 60),
          right: Math.round(node.getBoundingClientRect().right),
        }))
        .filter((entry) => entry.right > root.clientWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 3);

      return {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        widest,
      };
    });
  }

  /** The two notes rows, straight from the source of truth. */
  async function notesInDb() {
    const { data } = await admin
      .from("exercises")
      .select("name, notes")
      .eq("user_id", userId)
      .in("name", [EX_JUNK, EX_REAL]);

    return Object.fromEntries((data ?? []).map((row) => [row.name, row.notes]));
  }

  /** Run the REAL cleaner against the throwaway user. `assertTestUser` is
   * re-checked here because this is the one write in the drive that does not go
   * through the harness's own admin client. */
  async function runCleaner(args) {
    await assertTestUser(userId);

    return execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--env-file=.env.local",
        "scripts/clean-exercise-notes.ts",
        "--user",
        userId,
        ...args,
      ],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  }

  async function openLogger() {
    await session.go("/today", "h1");
    const start = page.getByRole("link", { name: /Start Workout/ }).first();
    await start.waitFor({ state: "visible", timeout: 10_000 });
    await start.click();
    await page.waitForURL(/\/log\//, { timeout: 20_000 });
    await page
      .locator(LOGGER_READY)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  // =====================================================================
  // CHECK 1 — ONE exercise's charts at a time
  //   The old surface painted 4 exercises × 2 charts = 8 canvases. Two
  //   canvases, one exercise name, is the fix.
  // =====================================================================
  await run.check(
    "1. Trends → PR history paints exactly ONE exercise's two charts (not 8 canvases)",
    async () => {
      await session.go(TRENDS, "h1");
      // `:visible` is load-bearing. Overview and Trends BOTH carry a
      // "Strength · PR history" <h2> and all three segments live in the DOM at
      // once, so the bare selector's FIRST match is Overview's — inside the
      // `hidden` div — and expectVisible resolves `.first()`. Without the
      // pseudo-class this waits 8s on a heading that is correctly invisible.
      await expectVisible(page, `h2:text-is("${PR_HEADING}"):visible`);

      const probe = await probePRSection(PR_HEADING);
      expectTrue(!probe.error, probe.error ?? "");

      expectTrue(
        probe.chartCount === 2,
        `expected exactly 2 painted chart canvases in the PR-history section, got ${probe.chartCount}: ` +
          JSON.stringify(probe.charts.map((c) => c.label)),
      );

      const names = exerciseNamesOf(probe);
      expectTrue(
        names.length === 1,
        `the section is charting ${names.length} exercises at once (${names.join(", ")}) — the whole fix is ONE`,
      );

      // One weight panel and one rep panel, not two of a kind.
      const series = probe.charts.map((chart) =>
        chart.label.includes("Weight PRs") ? "weight" : "rep",
      );
      expectTrue(
        series.includes("weight") && series.includes("rep"),
        `expected a Weight PRs chart and a Rep PRs chart, got ${JSON.stringify(probe.charts.map((c) => c.label))}`,
      );

      // The default lands on the most-PR'd lift, which is what the ranking is
      // for — no empty or arbitrary initial selection.
      expectTrue(
        names[0] === seed.topExerciseName,
        `the section opened on "${names[0]}", expected the most-PR'd lift "${seed.topExerciseName}"`,
      );

      const bad = await findSvgNaN(page);
      expectTrue(
        bad.length === 0,
        `non-finite values in SVG attributes: ${bad.slice(0, 5).join(" ")}`,
      );

      await shoot(page, "t2e-trends-pr-one-exercise");
      return `${probe.chartCount} canvases · 1 exercise ("${names[0]}") · ${probe.allSvgs} svg total in section`;
    },
  );

  // =====================================================================
  // CHECK 2 — the SELECTOR lists several exercises and actually swaps them
  //   Asserted on the rendered charts (name on the aria-labels, mark count,
  //   axis range in the panel header) — never on the select's own value.
  // =====================================================================
  await run.check(
    "2. the selector offers every exercise with PR history and SWAPS the rendered charts",
    async () => {
      await session.go(TRENDS, "h1");
      const before = await probePRSection(PR_HEADING);
      expectTrue(!before.error, before.error ?? "");

      expectTrue(
        before.select !== null && before.select.visible,
        "no visible exercise selector in the PR-history section",
      );
      expectTrue(
        before.select.options.length >= 2,
        `the selector offers ${before.select.options.length} exercise(s) — a selector with one option is not a selector`,
      );
      // Every option is a real, chartable exercise: no blank labels, no dupes.
      expectTrue(
        before.select.options.every(
          (option) => option.value.length > 0 && option.text.trim().length > 0,
        ),
        `the selector has an empty option: ${JSON.stringify(before.select.options)}`,
      );
      expectTrue(
        new Set(before.select.options.map((o) => o.value)).size ===
          before.select.options.length,
        "the selector lists the same exercise twice",
      );

      const beforeName = exerciseNamesOf(before)[0];
      const target = before.select.options.find(
        (option) => option.value !== before.select.value,
      );
      expectTrue(
        target !== undefined,
        "no second option to switch to — the selector cannot be exercised",
      );

      // The switch, made the way a human makes it.
      await page.selectOption(SELECTOR, target.value);
      await page.waitForFunction(
        ([headingText, previous]) => {
          const heading = [...document.querySelectorAll("h2")].find(
            (node) =>
              (node.textContent ?? "").trim() === headingText &&
              node.getClientRects().length > 0,
          );
          const svg = heading
            ?.closest("section")
            ?.querySelector("svg[aria-label*='personal-record history']");

          return Boolean(svg) && !svg.getAttribute("aria-label").includes(previous); // prettier-ignore
        },
        [PR_HEADING, beforeName],
        { timeout: 10_000 },
      );

      const after = await probePRSection(PR_HEADING);
      expectTrue(!after.error, after.error ?? "");

      // (a) still exactly one exercise, exactly two canvases
      expectTrue(
        after.chartCount === 2,
        `after the swap the section paints ${after.chartCount} canvases, expected 2`,
      );
      const afterNames = exerciseNamesOf(after);
      expectTrue(
        afterNames.length === 1,
        `after the swap ${afterNames.length} exercises are charted at once: ${afterNames.join(", ")}`,
      );

      // (b) the RENDERED identity changed — not just the control's value
      expectTrue(
        afterNames[0] !== beforeName,
        `the charts still belong to "${beforeName}" after selecting "${target.text}" — the control moved, the charts did not`,
      );
      expectTrue(
        after.cardText.includes(afterNames[0]),
        `the card headline does not name "${afterNames[0]}": ${after.cardText.slice(0, 160)}`,
      );
      // The OLD exercise must be gone from the section entirely, not merely
      // pushed below the fold or hidden behind a class.
      expectTrue(
        !after.charts.some((chart) => chart.label.includes(beforeName)),
        `a chart for the previous exercise "${beforeName}" is still painted`,
      );

      // (c) the DATA changed, not only the label: the axis range each panel
      //     header prints, and/or the number of marks drawn.
      const headersBefore = before.charts.map((chart) => chart.header);
      const headersAfter = after.charts.map((chart) => chart.header);
      const marksBefore = before.charts.map((chart) => chart.marks);
      const marksAfter = after.charts.map((chart) => chart.marks);
      expectTrue(
        JSON.stringify(headersBefore) !== JSON.stringify(headersAfter) ||
          JSON.stringify(marksBefore) !== JSON.stringify(marksAfter),
        `the charts redrew with IDENTICAL data — headers ${JSON.stringify(headersAfter)} ` +
          `and marks ${JSON.stringify(marksAfter)} are unchanged, so nothing but the title moved`,
      );
      expectTrue(
        marksAfter.every((count) => count > 0),
        `a swapped-in chart drew no marks: ${JSON.stringify(after.charts)}`,
      );

      const bad = await findSvgNaN(page);
      expectTrue(bad.length === 0, `NaN in SVG: ${bad.slice(0, 5).join(" ")}`);

      await shoot(page, "t2e-trends-pr-after-swap");
      return (
        `${before.select.options.length} options · "${beforeName}" ${JSON.stringify(headersBefore)} ` +
        `→ "${afterNames[0]}" ${JSON.stringify(headersAfter)}`
      );
    },
  );

  // =====================================================================
  // CHECK 3 — 390px, one-handed, no horizontal scroll
  // =====================================================================
  await run.check(
    "3. mobile 390px: the selector and charts fit with no horizontal overflow",
    async () => {
      await session.setViewport("mobile");
      await session.go(TRENDS, "h1");

      const select = await expectVisible(page, SELECTOR);
      const box = await select.boundingBox();
      expectTrue(
        box !== null && box.width > 0,
        "the selector has no painted box at 390px",
      );
      expectTrue(
        box.width <= 390 && box.x >= 0,
        `the selector overflows the viewport: x=${box.x} w=${box.width}`,
      );
      // A one-handed tap target: 44px is the platform floor.
      expectTrue(
        box.height >= 40,
        `the selector is ${box.height.toFixed(0)}px tall — too small to hit one-handed`,
      );

      const overflow = await probeOverflow();
      expectTrue(
        overflow.scrollWidth <= overflow.clientWidth,
        `the page scrolls horizontally at 390px: scrollWidth ${overflow.scrollWidth} > clientWidth ` +
          `${overflow.clientWidth}. Widest offenders: ${JSON.stringify(overflow.widest)}`,
      );

      // And with the OTHER exercise selected — a longer name must not widen it.
      const probe = await probePRSection(PR_HEADING);
      const other = probe.select.options.find(
        (option) => option.value !== probe.select.value,
      );

      if (other) {
        await page.selectOption(SELECTOR, other.value);
        await page.waitForTimeout(250);
        const after = await probeOverflow();
        expectTrue(
          after.scrollWidth <= after.clientWidth,
          `selecting "${other.text}" made the page scroll horizontally: ` +
            `${after.scrollWidth} > ${after.clientWidth} — ${JSON.stringify(after.widest)}`,
        );
      }

      await shoot(page, "t2e-mobile-390");
      return `scrollWidth ${overflow.scrollWidth} <= clientWidth ${overflow.clientWidth} · selector ${Math.round(box.width)}×${Math.round(box.height)}px`;
    },
  );

  // =====================================================================
  // CHECK 4a — the junk note REPRODUCES in the picker
  //   A cleanup check that starts from clean data proves nothing. This is the
  //   RED half: the bug Marcus saw, on screen, before anything is cleaned.
  // =====================================================================
  await run.check(
    "4a. RED: the logger's exercise picker renders the polluted note",
    async () => {
      await openLogger();
      await expectVisible(page, EX_JUNK);
      await expectVisible(page, EX_REAL);

      // The stutter as a human sees it: the note collapses to "Compound
      // Compound Compound" in innerText.
      await expectText(page, "Compound Compound Compound");
      await expectText(page, REAL_NOTE);

      await shoot(page, "t2e-picker-before-clean");
      const text = await visibleText(page, "ul");
      return `picker text: ${text.slice(0, 120)}`;
    },
  );

  // =====================================================================
  // CHECK 4b — the cleaner's DRY RUN is a dry run
  // =====================================================================
  await run.check(
    "4b. clean-exercise-notes dry-run reports 1 CLEAR / 1 KEEP and writes NOTHING",
    async () => {
      const output = await runCleaner([]);

      expectTrue(
        /DRY-RUN — nothing written/.test(output),
        `dry-run output never said it was a dry run:\n${output.slice(-500)}`,
      );
      expectTrue(
        /→ CLEAR \(junk\)\s+1\b/.test(output),
        `expected exactly 1 CLEAR row, got:\n${output.slice(-700)}`,
      );
      expectTrue(
        /→ KEEP\s+\(real notes\)\s+1\b/.test(output),
        `expected exactly 1 KEEP row, got:\n${output.slice(-700)}`,
      );
      // The trap, named in the report rather than silently cleared.
      expectTrue(
        output.includes(EX_JUNK) && output.includes(EX_REAL),
        "the report does not list both fixture exercises",
      );

      const after = await notesInDb();
      expectTrue(
        after[EX_JUNK] === JUNK_NOTE && after[EX_REAL] === REAL_NOTE,
        `the DRY RUN wrote to the table: ${JSON.stringify(after)}`,
      );

      return "dry-run: 1 CLEAR, 1 KEEP, 0 writes";
    },
  );

  // =====================================================================
  // CHECK 4c — --apply clears the junk and keeps the real note
  // =====================================================================
  await run.check(
    "4c. GREEN: --apply clears ONLY the junk; the picker shows no note for it and keeps the real one",
    async () => {
      const output = await runCleaner(["--apply"]);
      expectTrue(
        /APPLIED — 1 row\(s\) cleared/.test(output),
        `--apply did not report exactly one cleared row:\n${output.slice(-500)}`,
      );

      const after = await notesInDb();
      expectTrue(
        after[EX_JUNK] === "",
        `the junk note was not cleared: ${JSON.stringify(after[EX_JUNK])}`,
      );
      expectTrue(
        after[EX_REAL] === REAL_NOTE,
        `the REAL note was damaged: ${JSON.stringify(after[EX_REAL])}`,
      );

      // Back to the picker a human would look at.
      await openLogger();
      await expectVisible(page, EX_JUNK);
      await expectVisible(page, EX_REAL);
      await expectNoText(page, "Compound");
      await expectText(page, REAL_NOTE);

      // The junk exercise's <li> now carries its name and meta line and nothing
      // else — proof the note element is gone, not merely emptied of text.
      const junkRowText = await visibleText(page, `li:has-text("${EX_JUNK}")`);
      expectTrue(
        !/compound/i.test(junkRowText),
        `the junk row still reads: ${junkRowText}`,
      );

      await shoot(page, "t2e-picker-after-clean");

      // Idempotent: a second --apply is a no-op.
      const again = await runCleaner(["--apply"]);
      expectTrue(
        /Nothing to write — no type-only notes left/.test(again),
        `a second --apply was not a no-op:\n${again.slice(-400)}`,
      );

      return `"${EX_JUNK}" note cleared · "${EX_REAL}" kept "${REAL_NOTE}" · re-run is a no-op`;
    },
  );

  // =====================================================================
  // CHECK 5 — desktop pass
  // =====================================================================
  await run.check(
    "5. desktop 1280x900: one exercise, two charts, the selector still swaps",
    async () => {
      await session.setViewport("desktop");
      await session.go(TRENDS, "h1");

      const before = await probePRSection(PR_HEADING);
      expectTrue(!before.error, before.error ?? "");
      expectTrue(
        before.chartCount === 2 && exerciseNamesOf(before).length === 1,
        `desktop paints ${before.chartCount} canvases across ${exerciseNamesOf(before).length} exercises`,
      );

      const beforeName = exerciseNamesOf(before)[0];
      const target = before.select.options.find(
        (option) => option.value !== before.select.value,
      );
      await page.selectOption(SELECTOR, target.value);
      await page.waitForFunction(
        ([headingText, previous]) => {
          const heading = [...document.querySelectorAll("h2")].find(
            (node) =>
              (node.textContent ?? "").trim() === headingText &&
              node.getClientRects().length > 0,
          );
          const svg = heading
            ?.closest("section")
            ?.querySelector("svg[aria-label*='personal-record history']");

          return Boolean(svg) && !svg.getAttribute("aria-label").includes(previous); // prettier-ignore
        },
        [PR_HEADING, beforeName],
        { timeout: 10_000 },
      );

      const after = await probePRSection(PR_HEADING);
      expectTrue(
        after.chartCount === 2 && exerciseNamesOf(after)[0] !== beforeName,
        `the swap did not hold at desktop width: ${JSON.stringify(after.charts.map((c) => c.label))}`,
      );

      const bad = await findSvgNaN(page);
      expectTrue(bad.length === 0, `NaN in SVG: ${bad.slice(0, 3).join(" ")}`);

      await shoot(page, "t2e-trends-pr-one-exercise");
      await session.setViewport("mobile");
      return `"${beforeName}" → "${exerciseNamesOf(after)[0]}" at 1280x900`;
    },
  );

  // =====================================================================
  // CHECK 6 — the Overview featured slot is UNCHANGED
  //   FIX 1 was scoped to Trends. Overview keeps ONE featured exercise and no
  //   control; a selector appearing there would be scope creep on the glance.
  // =====================================================================
  await run.check(
    "6. Overview still shows the single featured lift with NO selector",
    async () => {
      await session.go("/progress", "h1");
      const probe = await probePRSection(PR_HEADING);
      expectTrue(!probe.error, probe.error ?? "");

      expectTrue(
        probe.chartCount === 2,
        `Overview paints ${probe.chartCount} canvases, expected the featured exercise's 2`,
      );
      const names = exerciseNamesOf(probe);
      expectTrue(
        names.length === 1 && names[0] === seed.topExerciseName,
        `Overview features ${JSON.stringify(names)}, expected only "${seed.topExerciseName}"`,
      );
      expectTrue(
        probe.select === null,
        "a selector appeared on Overview — that control belongs to Trends",
      );

      await shoot(page, "t2e-overview-featured");
      return `featured "${names[0]}", no control`;
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
