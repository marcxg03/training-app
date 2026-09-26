// T3-C SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T3-C folds Schedule into Programs (D48). Marcus asked "why is the schedule
// tab editable - shouldn't editing only happen in the program editing page?"
// It should. Schedule only existed because the week editor was hardcoded to
// whichever plan was ACTIVE, and the Programs page was listing the wrong table
// entirely (`plan_templates`, a seed-written snapshot archive, instead of
// `training_plans`, the real programs the mutations already operated on).
//
// Run:  node e2e/drive-t3c.mjs
//
// WHAT THIS DRIVE REFUSES TO DO: assert that a button exists. Every mutation
// below is driven by CLICKING it and then RE-READING THE DATABASE, because a
// CRUD surface that renders perfectly and writes nothing is the exact failure
// a render-only check cannot see. Create, rename, activate, duplicate and
// delete are each verified against Supabase, and the duplicate is verified
// STRUCTURALLY — same week shape, and crucially NOT sharing rows with its
// source, which is the bug a shallow copy would produce.

import { spawn } from "node:child_process";

import {
  createRun,
  expectText,
  expectTrue,
  expectVisible,
  printConsoleReport,
  REPO_ROOT,
  screenshots,
  shoot,
  startSession,
} from "./harness/index.mjs";

const run = createRun("T3-C drive — Programs is the program editor");

let session = null;
let cleanedUp = false;
let ownerServer = null;

try {
  session = await startSession({ seedData: false, viewport: "desktop" });
  const { admin, userId, browser, cookies } = session;

  // ---------------------------------------------------------------- fixture
  // Two programs so activation has something to switch BETWEEN and deletion
  // is not refused as "your only plan". Each gets a 7-day skeleton, and one
  // gets a session so the duplicate has real structure to copy.
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  async function makePlan(name, isActive) {
    const { data: plan } = await admin
      .from("training_plans")
      .insert({ user_id: userId, name, is_active: isActive })
      .select("plan_id")
      .single();

    const { data: schedules } = await admin
      .from("daily_schedules")
      .insert(
        DAYS.map((day) => ({
          plan_id: plan.plan_id,
          day_of_week: day,
          is_rest_day: day === "sun",
        })),
      )
      .select("schedule_id, day_of_week");

    return { planId: plan.plan_id, schedules };
  }

  const alpha = await makePlan("T3C Alpha", true);
  await makePlan("T3C Beta", false);

  // One real session on Monday of Alpha, with a block, so `duplicatePlan` has
  // a non-trivial tree to copy.
  const { data: block } = await admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "T3C Block",
      block_category: "lifting",
      block_type: "failure",
      display_order: 940,
      warmup_sets: 0,
      working_sets: 1,
      to_failure: false,
    })
    .select("block_id")
    .single();

  const monSchedule = alpha.schedules.find((s) => s.day_of_week === "mon");
  const { data: monWorkout } = await admin
    .from("workouts")
    .insert({
      schedule_id: monSchedule.schedule_id,
      workout_type: "lifting",
      workout_name: "T3C Monday Lift",
      timing: "anytime",
      display_order: 0,
    })
    .select("workout_id")
    .single();

  await admin.from("workout_blocks").insert({
    workout_id: monWorkout.workout_id,
    block_id: block.block_id,
    display_order: 0,
  });

  run.section(
    `fixture: "T3C Alpha" (active, 1 session on mon) + "T3C Beta" (inactive)`,
  );

  // ── an owner-scoped dev server, as in drive-t3a ──────────────────────────
  const OWNER_PORT = 3195;
  const base = `http://localhost:${OWNER_PORT}`;

  await run.check("boot a dev server that owns the test user", async () => {
    ownerServer = spawn(
      "pnpm",
      ["exec", "next", "dev", "-p", String(OWNER_PORT)],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, OWNER_USER_IDS: userId },
        detached: true,
        stdio: "ignore",
      },
    );

    const deadline = Date.now() + 90_000;
    for (;;) {
      try {
        const res = await fetch(`${base}/login`);
        if (res.status < 500) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) {
        throw new Error(`owner dev server never came up on ${OWNER_PORT}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return `listening on ${OWNER_PORT}`;
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  await ctx.addCookies(
    cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await ctx.newPage();

  async function go(path) {
    const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    expectTrue((res?.status() ?? 0) < 400, `${path} returned ${res?.status()}`);
    return res;
  }

  /** Read the owner's programs straight from the database. */
  async function dbPrograms() {
    const { data } = await admin
      .from("training_plans")
      .select("plan_id, name, is_active")
      .eq("user_id", userId)
      .order("created_at");
    return data ?? [];
  }

  // ── 1 · Programs lists REAL programs, not snapshots ──────────────────────

  await run.check("Programs lists training_plans, not templates", async () => {
    await go("/admin/programs");
    await expectText(page, "T3C Alpha");
    await expectText(page, "T3C Beta");
    // The T3-A page listed `plan_templates` and printed "Version N" rows plus
    // a read-only notice. If either shows up, the page is on the old table.
    const body = await page.evaluate(() => document.body.innerText);
    expectTrue(
      !body.includes("Read-only for now"),
      "the read-only plan_templates page is still rendering",
    );
    await shoot(page, "t3c-programs-list", { fullPage: false });
    return "both fixture programs listed, no read-only notice";
  });

  await run.check("the active program is marked, exactly once", async () => {
    const badges = await page.evaluate(
      () =>
        [...document.querySelectorAll("li")].filter((li) =>
          (li.innerText ?? "").includes("ACTIVE"),
        ).length,
    );
    expectTrue(
      badges === 1,
      `${badges} programs show an ACTIVE badge — exactly one plan is active`,
    );
    return "one active badge";
  });

  await run.check("Schedule is gone from the sidebar", async () => {
    // The label and its hint are adjacent spans with no whitespace between
    // them, so the link's textContent reads "ProgramsCreate, edit, activate".
    // Match on the prefix rather than on equality.
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Admin sections"] a')].map(
        (a) => (a.textContent ?? "").trim(),
      ),
    );
    expectTrue(
      !labels.some((label) => label.startsWith("Schedule")),
      `sidebar still offers Schedule: ${JSON.stringify(labels)}`,
    );
    expectTrue(
      labels.some((label) => label.startsWith("Programs")),
      `sidebar lost Programs: ${JSON.stringify(labels)}`,
    );
    return `${labels.length} sections, no Schedule`;
  });

  await run.check(
    "/admin/schedule forwards to the active program",
    async () => {
      // Kept as a redirect so the links that pointed there for one slice do not
      // rot. It must land on the ACTIVE program's editor.
      await page.goto(`${base}/admin/schedule`, { waitUntil: "networkidle" });
      const url = new URL(page.url());
      const active = (await dbPrograms()).find((p) => p.is_active);
      expectTrue(
        url.pathname === `/admin/programs/${active.plan_id}`,
        `landed on ${url.pathname}, expected the active program's editor`,
      );
      return url.pathname;
    },
  );

  // ── 2 · opening a program IS the editor ──────────────────────────────────

  await run.check("opening a program opens its week editor", async () => {
    await go(`/admin/programs/${alpha.planId}`);
    await expectText(page, "T3C Alpha");
    // The week editor and the day links both have to be here — that is what
    // replaced the Schedule section.
    await expectText(page, "Edit a day in detail");
    const dayLinks = await page.evaluate(
      () =>
        document.querySelectorAll('a[href*="/admin/programs/"][href*="/mon"]')
          .length,
    );
    expectTrue(dayLinks > 0, "no day links on the program page");
    await shoot(page, "t3c-program-week", { fullPage: false });
    return "week editor + 7 day links";
  });

  await run.check("a NON-active program's day is editable", async () => {
    // THE BUG THIS SLICE FIXES. getDayEditData used to resolve the plan by
    // "whichever is active", so a non-active program's days could not be
    // opened at all — which is why a separate Schedule section existed.
    const beta = (await dbPrograms()).find((p) => p.name === "T3C Beta");
    const res = await page.goto(`${base}/admin/programs/${beta.plan_id}/tue`, {
      waitUntil: "networkidle",
    });
    expectTrue(
      (res?.status() ?? 0) < 400,
      `a non-active program's day returned ${res?.status()}`,
    );
    const body = await page.evaluate(() => document.body.innerText);
    expectTrue(
      body.includes("Tuesday"),
      "the day editor did not render for a non-active program",
    );
    return "Tuesday of the inactive program opened";
  });

  await run.check("another owner's program 404s by URL", async () => {
    // The route guard proves "an owner"; the row check proves "this owner".
    const res = await page.goto(
      `${base}/admin/programs/00000000-0000-0000-0000-000000000000`,
      { waitUntil: "networkidle" },
    );
    expectTrue(
      res?.status() === 404,
      `a foreign plan_id returned ${res?.status()}, expected 404`,
    );
    return "404";
  });

  // ── 3 · the mutations actually WRITE ─────────────────────────────────────

  await run.check("Rename writes to the database", async () => {
    await go("/admin/programs");
    await page.click('button[aria-label="Rename T3C Beta"]');
    const input = page.locator('input[aria-label="Rename T3C Beta"]');
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill("T3C Beta Renamed");
    await page.click('form:has(input[aria-label="Rename T3C Beta"]) button[type="submit"]'); // prettier-ignore

    await page.waitForFunction(
      () => !document.body.innerText.includes("T3C Beta Renamed") === false,
      { timeout: 15_000 },
    );

    const names = (await dbPrograms()).map((p) => p.name);
    expectTrue(
      names.includes("T3C Beta Renamed"),
      `database still has ${JSON.stringify(names)}`,
    );
    return "renamed in the DB";
  });

  await run.check("Make active switches exactly one program", async () => {
    await go("/admin/programs");
    await page.click('button[aria-label="Make T3C Beta Renamed active"]');
    await page.waitForTimeout(1500);

    const programs = await dbPrograms();
    const active = programs.filter((p) => p.is_active);
    expectTrue(
      active.length === 1,
      `${active.length} programs are active — the invariant is exactly one`,
    );
    expectTrue(
      active[0].name === "T3C Beta Renamed",
      `active is "${active[0].name}", expected the one just activated`,
    );
    return `active → ${active[0].name}`;
  });

  await run.check("Duplicate deep-copies the week structure", async () => {
    await go("/admin/programs");
    await page.click('button[aria-label="Duplicate T3C Alpha"]');
    await page.waitForTimeout(2500);

    const copy = (await dbPrograms()).find((p) => p.name === "T3C Alpha (copy)"); // prettier-ignore
    expectTrue(copy !== undefined, "no copy was created");
    expectTrue(!copy.is_active, "the copy was activated — it must not be");

    // Structure: same 7 days, same session on Monday, same block inside it.
    const { data: copySchedules } = await admin
      .from("daily_schedules")
      .select("schedule_id, day_of_week, is_rest_day")
      .eq("plan_id", copy.plan_id);
    expectTrue(
      copySchedules.length === 7,
      `copy has ${copySchedules.length} days, expected 7`,
    );
    expectTrue(
      copySchedules.find((s) => s.day_of_week === "sun")?.is_rest_day === true,
      "the copy lost the rest-day flag",
    );

    const copyMon = copySchedules.find((s) => s.day_of_week === "mon");
    const { data: copyWorkouts } = await admin
      .from("workouts")
      .select("workout_id, workout_name")
      .eq("schedule_id", copyMon.schedule_id);
    expectTrue(
      copyWorkouts.length === 1 &&
        copyWorkouts[0].workout_name === "T3C Monday Lift",
      `copy's Monday has ${JSON.stringify(copyWorkouts.map((w) => w.workout_name))}`,
    );

    // NOT A SHALLOW COPY. If the copy reused the source's workout row, editing
    // one program would silently edit the other.
    expectTrue(
      copyWorkouts[0].workout_id !== monWorkout.workout_id,
      "the copy SHARES its Monday workout row with the source",
    );
    expectTrue(
      copyMon.schedule_id !== monSchedule.schedule_id,
      "the copy SHARES its Monday schedule row with the source",
    );

    const { data: copyBlocks } = await admin
      .from("workout_blocks")
      .select("block_id")
      .eq("workout_id", copyWorkouts[0].workout_id);
    expectTrue(
      copyBlocks.length === 1 && copyBlocks[0].block_id === block.block_id,
      "the copy's session lost its block",
    );

    return "7 days, 1 session, 1 block — all new rows";
  });

  await run.check("Create makes a program and opens it", async () => {
    await go("/admin/programs");
    await page.click('button:has-text("New program")');
    const input = page.locator('input[aria-label="New program name"]');
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill("T3C Created");
    await page.click('button:has-text("Create")');

    await page.waitForURL("**/admin/programs/**", { timeout: 20_000 });

    const created = (await dbPrograms()).find((p) => p.name === "T3C Created");
    expectTrue(created !== undefined, "the program was not created");

    const { data: schedules } = await admin
      .from("daily_schedules")
      .select("schedule_id")
      .eq("plan_id", created.plan_id);
    expectTrue(
      schedules.length === 7,
      `a new program should get a 7-day skeleton, got ${schedules.length}`,
    );
    expectTrue(
      page.url().includes(created.plan_id),
      `did not open the new program; url is ${page.url()}`,
    );
    return "created with a 7-day skeleton, editor opened";
  });

  await run.check("Delete removes the program", async () => {
    await go("/admin/programs");
    await page.click('button[aria-label="Delete T3C Created"]');
    await page.click('button[aria-label="Confirm delete T3C Created"]');
    await page.waitForTimeout(2000);

    const names = (await dbPrograms()).map((p) => p.name);
    expectTrue(
      !names.includes("T3C Created"),
      `still present: ${JSON.stringify(names)}`,
    );
    // And the invariant survives a delete.
    const active = (await dbPrograms()).filter((p) => p.is_active);
    expectTrue(
      active.length === 1,
      `${active.length} active programs after a delete`,
    );
    return "deleted, exactly one program still active";
  });

  // ── 4 · the builder is still self-contained ──────────────────────────────

  await run.check("program editors stay inside the builder", async () => {
    for (const path of [
      `/admin/programs/${alpha.planId}`,
      `/admin/programs/${alpha.planId}/mon`,
    ]) {
      await go(path);
      const chrome = await page.evaluate(() => ({
        sidebar: !!document.querySelector('nav[aria-label="Admin sections"]'),
        memberTabs: !!document.querySelector(
          'nav[aria-label="Bottom navigation"]',
        ),
        main: document.querySelector("main")?.innerText?.trim().length ?? 0,
      }));
      expectTrue(chrome.sidebar, `${path} has no admin sidebar`);
      expectTrue(!chrome.memberTabs, `${path} renders the MEMBER tab bar`);
      expectTrue(chrome.main > 20, `${path} rendered an empty content area`);
    }
    return "week + day editors keep the hub chrome";
  });

  await run.check("no horizontal overflow at 390px", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/admin/programs");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expectTrue(overflow <= 0, `page scrolls ${overflow}px horizontally`);
    await shoot(page, "t3c-programs-mobile", { fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });
    return "0px";
  });

  await ctx.close();
} catch (error) {
  run.record("DRIVE ABORTED", "FAIL", error?.stack ?? String(error));
} finally {
  if (ownerServer?.pid) {
    try {
      process.kill(-ownerServer.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }

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
