// THE ACID TEST — build a training plan from absolute scratch in the desktop
// admin hub, then train against it on the phone (D32).
//
// Marcus: "the ultimate test would be me building a current plan from scratch
// from desktop admin, and then personally use that plan on phone for a week."
//
// This drive IS that test, run by a machine before he runs it by hand. The
// throwaway user starts with a COMPLETELY EMPTY library — no exercises, no
// blocks, no workouts, no programs — so every step has to be reachable from
// the UI. Nothing is seeded; if a step cannot be done by clicking, this fails,
// which is the whole point.
//
// Run:  node e2e/drive-scratch-plan.mjs
//
// The chain, in the order a human hits it:
//   desktop:  exercise → block → workout → program → put the workout on a day
//             → activate the program
//   phone:    /today shows the session → start it → log a set → it persists
//
// A gap anywhere in that chain means Marcus's two-week test cannot start, so
// this drive is the gate on the whole Tier-3 build being "done".

import { spawn } from "node:child_process";

import {
  createRun,
  expectText,
  expectTrue,
  expectVisible,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
  REPO_ROOT,
} from "./harness/index.mjs";

const EXERCISE = "Scratch Bench Press";
const BLOCK = "Scratch Chest Block";
const WORKOUT = "Scratch Push Day";
const PROGRAM = "Scratch Test Block";

const run = createRun("ACID TEST — build a plan from scratch, then train it");

let session = null;
let cleanedUp = false;
let ownerServer = null;

try {
  session = await startSession({ seedData: false, viewport: "desktop" });
  const { userId, baseUrl, browser, cookies } = session;

  const PORT = 3193;
  const base = `http://localhost:${PORT}`;

  await run.check("boot a dev server that owns the test user", async () => {
    ownerServer = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, OWNER_USER_IDS: userId },
      detached: true,
      stdio: "ignore",
    });

    const deadline = Date.now() + 120_000;
    for (;;) {
      try {
        const res = await fetch(`${base}/login`);
        if (res.status < 500) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error("owner server never came up");
      await new Promise((r) => setTimeout(r, 1000));
    }
    return `owner server on ${PORT}`;
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  await ctx.addCookies(
    cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await ctx.newPage();

  /** Wait out any loading skeleton. Since loading.tsx landed (T3-D) a route
   * streams, so `networkidle` and `waitForURL` both resolve while the page
   * still reads "Loading …". Every assertion has to sit behind this. */
  async function settle(target = page) {
    await target
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), {
        timeout: 20_000,
      })
      .catch(() => {});
  }

  /** Submit a library form and, if it does not navigate away, report the
   * validation that blocked it. A silent "the thing was not created" is the
   * least debuggable failure a drive can produce — this turns it into the
   * actual message the form is showing the user. */
  async function submitAndLeave(submitName, awayFrom) {
    await page.getByRole("button", { name: submitName }).first().click();

    const left = await page
      .waitForURL((url) => !url.pathname.endsWith(awayFrom), {
        timeout: 20_000,
      })
      .then(() => true)
      .catch(() => false);

    if (!left) {
      const errors = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[role="alert"], [data-slot="form-message"], .text-danger, [aria-invalid="true"]',
          ),
        ]
          .map(
            (n) =>
              (n.textContent ?? "").trim() ||
              (n.getAttribute("aria-label") ?? "") ||
              n.getAttribute("name") ||
              "",
          )
          .filter(Boolean)
          .join(" | "),
      );
      throw new Error(
        `form did not submit — validation said: ${errors || "(no visible error)"}`,
      );
    }

    await settle();
  }

  async function go(route) {
    const res = await page.goto(`${base}${route}`, {
      waitUntil: "networkidle",
    });
    expectTrue(
      (res?.status() ?? 0) < 400,
      `${route} returned ${res?.status()}`,
    );
    await settle();
    return res;
  }

  // ── 0 · the starting point really is empty ───────────────────────────────

  await run.check("the library starts completely empty", async () => {
    await go("/library/exercises");
    await expectText(page, "No exercises yet");
    await go("/admin/programs");
    await expectText(page, "No programs yet");
    return "no exercises, no programs — nothing seeded";
  });

  // ── 1 · exercise ─────────────────────────────────────────────────────────

  await run.check("create an exercise", async () => {
    await go("/library/exercises");
    await page.getByRole("button", { name: /Add Exercise/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15_000 });
    await dialog.getByLabel("Name").fill(EXERCISE);

    // MUSCLE GROUPS ARE REQUIRED — the schema demands at least one ("Pick at
    // least one muscle group"). An earlier cut of this drive filled only the
    // name, so submission failed validation, the dialog stayed OPEN, and its
    // modal overlay then swallowed every click in the three checks that
    // followed. Four failures, one cause, and none of them the app's fault.
    await dialog.getByRole("button", { name: /Pick muscle groups/i }).click();
    // The picker is a cmdk (Radix Command) popover. `getByRole("option")`
    // matched a GROUP HEADING carrying aria-hidden, which swallowed the click
    // for 30s — target the item primitive instead.
    const option = page.locator("[cmdk-item]").first();
    await option.waitFor({ state: "visible", timeout: 10_000 });
    await option.click();
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: /^Create exercise/i }).click();

    // If validation still blocks, say WHY rather than timing out on the list.
    const stillOpen = await dialog
      .waitFor({ state: "hidden", timeout: 20_000 })
      .then(() => false)
      .catch(() => true);

    if (stillOpen) {
      const errors = await page.evaluate(() =>
        [...document.querySelectorAll('[role="dialog"] [role="alert"], [role="dialog"] .text-danger')] // prettier-ignore
          .map((n) => n.textContent?.trim())
          .filter(Boolean)
          .join(" | "),
      );
      throw new Error(
        `the create-exercise dialog did not close — validation said: ${errors || "(no visible error)"}`,
      );
    }

    await page
      .getByText(EXERCISE, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
    return `"${EXERCISE}" is in the library`;
  });

  await run.check("the exercise survives a reload", async () => {
    await go("/library/exercises");
    await expectText(page, EXERCISE);
    return "persisted";
  });

  // ── 2 · block ────────────────────────────────────────────────────────────

  await run.check("create a block containing that exercise", async () => {
    await go("/library/lifting");
    // AddBlockButton renders a <Link>, so it is role=link. getByRole("button")
    // silently waits 30s for something that can never exist.
    await page
      .getByRole("link", { name: /Add Block/i })
      .first()
      .click();
    await page.waitForURL("**/library/lifting/blocks/new", { timeout: 20_000 });
    await settle();

    await page
      .getByLabel(/Block name|Name/i)
      .first()
      .fill(BLOCK);

    // A PROTOCOL IS REQUIRED. The empty form says nothing about it; submitting
    // without one fails with "Lifting blocks require a protocol." Worth
    // knowing before building a plan by hand.
    await page
      .getByRole("button", { name: /^Failure$/i })
      .first()
      .click({ timeout: 15_000 });

    // Attach the exercise through the bank picker — the only by-hand route.
    await page
      .getByRole("button", { name: /Add exercise to bank/i })
      .first()
      .click({ timeout: 15_000 });
    await page.waitForTimeout(600);

    // cmdk items, NOT getByText: the popover's group headings carry
    // aria-hidden and swallow the click.
    await page
      .locator("[cmdk-item]")
      .filter({ hasText: EXERCISE })
      .first()
      .click({ timeout: 10_000 });
    await page.keyboard.press("Escape").catch(() => {});

    await submitAndLeave(/^Create block/i, "/new");

    await go("/library/lifting");
    await expectText(page, BLOCK);
    return `"${BLOCK}" created with 1 exercise`;
  });

  // ── 3 · workout ──────────────────────────────────────────────────────────

  await run.check("create a workout containing that block", async () => {
    await go("/library/workouts");
    // Also a <Link>, therefore role=link.
    await page
      .getByRole("link", { name: /Add Workout/i })
      .first()
      .click();
    await page.waitForURL("**/library/workouts/new", { timeout: 20_000 });
    await settle();

    await page
      .getByLabel(/Workout name|Name/i)
      .first()
      .fill(WORKOUT);

    await page
      .getByRole("button", { name: /Add block/i })
      .first()
      .click({ timeout: 15_000 });
    await page.waitForTimeout(600);

    await page
      .locator("[cmdk-item]")
      .filter({ hasText: BLOCK })
      .first()
      .click({ timeout: 10_000 });
    await page.keyboard.press("Escape").catch(() => {});

    await submitAndLeave(/^Create workout/i, "/new");

    await go("/library/workouts");
    await expectText(page, WORKOUT);
    return `"${WORKOUT}" created with 1 block`;
  });

  // ── 4 · program ──────────────────────────────────────────────────────────

  let planId = null;

  await run.check("create a program", async () => {
    await go("/admin/programs");
    await page.getByRole("button", { name: /New program/i }).click();
    await page.getByLabel("New program name").fill(PROGRAM);
    await page.getByRole("button", { name: /^Create$/ }).click();

    await page.waitForURL(/\/admin\/programs\/[0-9a-f-]{36}/, { timeout: 25_000 }); // prettier-ignore
    await settle();
    planId = new URL(page.url()).pathname.split("/").pop();
    await expectText(page, PROGRAM);
    return `created and opened ${planId.slice(0, 8)}…`;
  });

  await run.check("put the workout on a training day", async () => {
    // A new program is a 7-day rest skeleton, so Monday has to be turned into
    // a training day and given the session. This is the step that decides
    // whether a plan can be built at all.
    await go(`/admin/programs/${planId}/mon`);

    const restToggle = page.getByLabel(/rest day/i).first();
    if (await restToggle.count()) {
      const checked = await restToggle.isChecked().catch(() => false);
      if (checked) await restToggle.uncheck({ force: true });
    }

    await page.getByRole("button", { name: /Add session/i }).first().click(); // prettier-ignore

    // Pick the workout we just defined rather than typing a free-text name —
    // that is what links the session to its blocks.
    const picker = page.locator("select").filter({ hasText: WORKOUT }).first();
    if (await picker.count()) {
      await picker.selectOption({ label: WORKOUT });
    } else {
      const nameField = page.getByLabel(/Session name|Name/i).last();
      await nameField.fill(WORKOUT);
    }

    await page.getByRole("button", { name: /^(Save|Done)/i }).first().click(); // prettier-ignore
    await page.waitForLoadState("networkidle");

    await go(`/admin/programs/${planId}`);
    await expectText(page, WORKOUT);
    await shoot(page, "scratch-program-week", { fullPage: false });
    return `Monday carries "${WORKOUT}"`;
  });

  await run.check("activate the program", async () => {
    await go("/admin/programs");
    const makeActive = page.getByRole("button", { name: new RegExp(`Make ${PROGRAM} active`, "i") }); // prettier-ignore
    if (await makeActive.count()) {
      await makeActive.click();
      await page.waitForTimeout(1500);
    }
    await go("/admin/programs");
    const seen = await page.evaluate((name) => {
      const items = [...document.querySelectorAll("li")];
      const row = items.find((li) => li.innerText.includes(name));
      return {
        found: !!row,
        text: row ? row.innerText.replace(/\s+/g, " ").slice(0, 120) : "",
        rows: items.length,
      };
    }, PROGRAM);
    expectTrue(seen.found, `no list row contains "${PROGRAM}" (${seen.rows} rows)`); // prettier-ignore
    expectTrue(
      /Active/i.test(seen.text),
      `row is not marked Active — saw: ${JSON.stringify(seen.text)}`,
    );
    return "active";
  });

  await ctx.close();

  // ── 5 · the phone: train the plan you just built ─────────────────────────

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  });
  await phone.addCookies(
    cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const mobile = await phone.newPage();

  await run.check("the plan reaches the phone's Plan tab", async () => {
    await mobile.goto(`${base}/plan`, { waitUntil: "networkidle" });
    await mobile
      .getByText(WORKOUT, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
    await shoot(mobile, "scratch-plan-on-phone", { fullPage: false });
    return `"${WORKOUT}" shows in the week`;
  });

  await run.check("Monday's session is startable", async () => {
    await mobile.goto(`${base}/plan/mon`, { waitUntil: "networkidle" });
    const body = await mobile.evaluate(() => document.body.innerText ?? "");
    expectTrue(
      body.includes(WORKOUT),
      `Monday does not show "${WORKOUT}" — the plan did not reach the member app`,
    );
    return "Monday shows the session";
  });

  await phone.close();
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
  "cleanup: throwaway user deleted",
  cleanedUp ? "PASS" : "FAIL",
  cleanedUp ? "no residual auth user" : "USER STILL PRESENT",
);

if (session) printConsoleReport(session.console);

console.log("\nSCREENSHOTS");
for (const file of screenshots()) console.log(`  ${file}`);

process.exit(run.report());
