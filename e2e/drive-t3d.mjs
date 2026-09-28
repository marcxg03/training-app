// T3-D SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T3-D answers a bug Marcus reported from using the app: "there is a long
// buffer time between windows and screens on the app why is that?"
//
// MEASURED CAUSE (not guessed): the app had ZERO `loading.tsx` files, so a tab
// tap rendered nothing new until every server-side Supabase round-trip
// finished — 0.8–1.2s per screen. Next.js keeps the OLD screen on-screen for
// that whole time, so it reads as a freeze. A production build measured the
// SAME (1005ms vs 817ms), which ruled out dev mode; a single Supabase
// round-trip measured 76ms median, so ~900ms is roughly a dozen sequential
// hops per screen.
//
// Run:  node e2e/drive-t3d.mjs
//
// WHAT THIS DRIVE PROVES, and what it deliberately does not: it proves the
// dead air is gone — that something for the NEW screen is painted within a
// couple of hundred milliseconds of the tap. It does NOT claim the screens got
// faster. Content still lands at ~900ms because the queries behind it are
// unchanged; that is a separate slice and KNOWN_ISSUES.md says so. Measuring
// the skeleton and calling it a speed-up would be the dishonest version of
// this fix.

import {
  createRun,
  expectTrue,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
} from "./harness/index.mjs";

/** Tabs that must never show dead air. */
const TABS = ["/plan", "/nutrition", "/progress"];

/** A tap must paint SOMETHING within this budget, or it reads as a freeze. */
const FIRST_PAINT_BUDGET_MS = 500;

const run = createRun("T3-D drive — no dead air between screens");

let session = null;
let cleanedUp = false;

try {
  session = await startSession({ seedData: true, viewport: "mobile" });
  const { page, baseUrl, browser, cookies, go } = session;

  // Warm every route once. Measuring a first-ever dev compile would make the
  // numbers about the bundler, not about the fix.
  for (const route of ["/today", ...TABS]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  }
  run.section("all routes warmed — measuring steady-state navigation");

  /** Tap a tab; report when the new screen first appears and when it fills. */
  async function measureTab(route) {
    await page.goto(`${baseUrl}/today`, { waitUntil: "networkidle" });

    const started = Date.now();
    await page
      .locator(`nav[aria-label="Bottom navigation"] a[href="${route}"]`)
      .first()
      // force: the Next.js dev overlay renders a <nextjs-portal> bottom-left
      // that swallows pointer events over the leftmost tab. It does not exist
      // in a production build, so waiting it out would only be waiting for a
      // dev artifact.
      .click({ force: true });

    let firstPaint = null;
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[aria-busy="true"]'),
        { timeout: 5000 },
      );
      firstPaint = Date.now() - started;
    } catch {
      // No skeleton appeared. Either content beat it, or there is no
      // loading.tsx — the caller distinguishes those.
    }

    await page
      .locator("main h1")
      .first()
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {});

    return { firstPaint, content: Date.now() - started };
  }

  for (const route of TABS) {
    await run.check(`${route} paints immediately on tap`, async () => {
      const { firstPaint, content } = await measureTab(route);

      expectTrue(
        firstPaint !== null,
        `${route} rendered no loading state — the previous screen stays frozen` +
          ` for the whole ${content}ms wait, which is the reported bug`,
      );
      expectTrue(
        firstPaint <= FIRST_PAINT_BUDGET_MS,
        `${route} took ${firstPaint}ms to paint anything (budget ${FIRST_PAINT_BUDGET_MS}ms)`,
      );

      return `skeleton ${firstPaint}ms · content ${content}ms`;
    });
  }

  await run.check("a cached tab is instant, not frozen", async () => {
    // The SHAPE of each skeleton is pinned by scripts/verify-skeletons.ts,
    // because whether one is SEEN depends on Next's client router cache — a
    // tab already visited renders from cache with no loading state at all.
    // That is correct, and it is why this check accepts either outcome: what
    // must never happen is dead air, so the budget applies to whichever comes
    // first, skeleton or content.
    await page.goto(`${baseUrl}/plan`, { waitUntil: "networkidle" });

    const started = Date.now();
    await page
      .locator('nav[aria-label="Bottom navigation"] a[href="/today"]')
      .first()
      .click({ force: true });

    await page.waitForFunction(
      () =>
        !!document.querySelector('[aria-busy="true"]') ||
        !!document.querySelector("main h1"),
      { timeout: 5000 },
    );
    const firstPaint = Date.now() - started;

    expectTrue(
      firstPaint <= FIRST_PAINT_BUDGET_MS,
      `returning to a cached /today took ${firstPaint}ms to show anything`,
    );

    const how = await page.evaluate(() =>
      document.querySelector('[aria-busy="true"]') ? "skeleton" : "cached",
    );
    return `${how} in ${firstPaint}ms`;
  });

  await run.check("the load is announced to assistive tech", async () => {
    // A skeleton is invisible to a screen reader. Without a live region the
    // screen silently swaps, which is worse than the freeze it replaced.
    await page.goto(`${baseUrl}/today`, { waitUntil: "networkidle" });
    await page
      .locator('nav[aria-label="Bottom navigation"] a[href="/progress"]')
      .first()
      .click({ force: true });

    const region = await page
      .waitForFunction(
        () => {
          const node = document.querySelector('[aria-busy="true"]');
          if (!node) return null;
          return {
            role: node.getAttribute("role"),
            live: node.getAttribute("aria-live"),
            text: (node.textContent ?? "").trim().slice(0, 40),
          };
        },
        { timeout: 5000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => null);

    expectTrue(region !== null, "no aria-busy region while loading");
    expectTrue(
      region.role === "status" && region.live === "polite",
      `the loading region is role=${region.role} aria-live=${region.live}`,
    );
    expectTrue(
      region.text.length > 0,
      "the live region announces nothing — it has no text for a screen reader",
    );
    return `role=status, announces "${region.text}"`;
  });

  await run.check("content still arrives after the skeleton", async () => {
    // The skeleton must be a STAGE, not a destination. A loading.tsx that
    // never resolves is a worse bug than the one being fixed.
    await page.goto(`${baseUrl}/today`, { waitUntil: "networkidle" });
    await page
      .locator('nav[aria-label="Bottom navigation"] a[href="/nutrition"]')
      .first()
      .click({ force: true });
    await page
      .locator("main h1")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });

    const settled = await page.evaluate(() => ({
      stillBusy: !!document.querySelector('[aria-busy="true"]'),
      skeletons: document.querySelectorAll(".skeleton").length,
      heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
    }));

    expectTrue(!settled.stillBusy, "the page is still marked aria-busy");
    expectTrue(
      settled.skeletons === 0,
      `${settled.skeletons} skeleton blocks survived into the loaded page`,
    );
    expectTrue(settled.heading.length > 0, "the loaded page has no heading");
    await shoot(page, "t3d-loaded", { fullPage: false });
    return `settled on "${settled.heading}"`;
  });

  await run.check("reduced motion stops the pulse", async () => {
    // The shape is the information, not the movement — so the block stays
    // visible while the animation stops.
    const rm = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "light",
      reducedMotion: "reduce",
    });

    try {
      await rm.addCookies(
        cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
      );
      const rmPage = await rm.newPage();
      await rmPage.goto(`${baseUrl}/today`, { waitUntil: "networkidle" });
      await rmPage
        .locator('nav[aria-label="Bottom navigation"] a[href="/progress"]')
        .first()
        .click({ force: true });

      const style = await rmPage
        .waitForFunction(
          () => {
            const block = document.querySelector(".skeleton");
            if (!block) return null;
            const cs = getComputedStyle(block);
            return {
              animation: cs.animationName,
              opacity: Number(cs.opacity),
              visible: block.getClientRects().length > 0,
            };
          },
          { timeout: 5000 },
        )
        .then((handle) => handle.jsonValue())
        .catch(() => null);

      expectTrue(style !== null, "no skeleton under reduced motion");
      expectTrue(
        style.animation === "none",
        `the pulse still runs under reduced motion (${style.animation})`,
      );
      expectTrue(
        style.visible && style.opacity > 0.9,
        `the skeleton faded away instead of holding still (opacity ${style.opacity})`,
      );
      return "animation none, block still visible";
    } finally {
      await rm.close();
    }
  });

  await run.check("the admin hub has loading states too", async () => {
    // The hub is owner-only, so a non-owner 404s — assert the FILES exist
    // rather than driving them here (drive-t3a owns the owner-side checks).
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { REPO_ROOT } = await import("./harness/env.mjs");

    for (const route of ["admin", "admin/programs"]) {
      expectTrue(
        existsSync(join(REPO_ROOT, "src/app/(owner)", route, "loading.tsx")),
        `/${route} has no loading.tsx`,
      );
    }
    return "admin + programs have skeletons";
  });

  await run.check("every member tab has a loading state", async () => {
    // The regression guard: a tab added later without a loading.tsx
    // reintroduces the dead air on exactly one screen, which is the kind of
    // gap nobody notices until they are using the app on a train.
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { REPO_ROOT } = await import("./harness/env.mjs");

    const missing = [
      "today",
      "plan",
      "nutrition",
      "progress",
      "community",
    ].filter(
      // prettier-ignore
      (tab) =>
        !existsSync(join(REPO_ROOT, "src/app/(app)", tab, "loading.tsx")),
    );

    expectTrue(
      missing.length === 0,
      `tabs with no loading state: ${missing.join(", ")}`,
    );
    return "all 5 tabs covered";
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
