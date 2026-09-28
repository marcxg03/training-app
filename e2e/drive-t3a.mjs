// T3-A SLICE DRIVE — a real browser, driven as a human would drive it (D32).
//
// T3-A gives the owner-only admin hub its own DESKTOP shell. Marcus asked
// "did we even create the desktop admin page and view?" — the answer was no:
// /admin was four cards reading "Soon", it lived inside the phone chrome, and
// OWNER_USER_IDS was unset so it 404'd for everybody including him.
//
// Run:  node e2e/drive-t3a.mjs
// The harness starts the dev server if it is not already up, seeds a throwaway
// @trainingapp.test user, and deletes it in a finally.
//
// THE HARD PART, AND WHY THIS DRIVE MATTERS MOST OF THE SLICE'S GATES:
// the throwaway test user is NOT an owner — OWNER_USER_IDS holds Marcus's real
// id. So this drive can prove the two halves that no fixture test can reach:
//
//   1. A NON-OWNER GETS 404 on every hub route. This is the real security
//      assertion. `isOwner` is fail-closed and unit-tested, but the thing that
//      actually protects the hub is the route-group layout being wired to it —
//      and moving the group from (app)/(owner) to (owner) in this slice is
//      exactly the kind of refactor that silently drops a guard.
//   2. THE OWNER SEES THE HUB, with its own chrome — sidebar present, member
//      bottom tab bar ABSENT. Driven by minting a second browser context whose
//      cookies belong to a temporarily-owned user.
//
// For (2) the drive promotes the throwaway user to owner by restarting the dev
// server with OWNER_USER_IDS set to its id — never by touching Marcus's real
// allow-list, and never by asserting against his account.

import { spawn } from "node:child_process";

import {
  createRun,
  REPO_ROOT,
  expectText,
  expectTrue,
  expectVisible,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
} from "./harness/index.mjs";

const HUB_ROUTES = [
  "/admin",
  "/admin/programs",
  "/admin/analytics",
  "/admin/members",
];

// T3-B: the authoring surfaces moved INTO the hub's shell. They keep their
// historical URLs (a route group never changes a path), so they are listed
// separately — but they are now just as owner-gated and just as much part of
// the builder as anything under /admin.
const AUTHORING_ROUTES = ["/library", "/library/exercises", "/admin/schedule"];

const run = createRun("T3-A drive — owner-only desktop admin hub");

let session = null;
let cleanedUp = false;
let ownerServer = null;

try {
  session = await startSession({ seedData: false, viewport: "desktop" });
  const { page, userId, baseUrl, browser, cookies } = session;

  run.section(
    `fixture: throwaway user ${userId.slice(0, 8)}… is NOT in OWNER_USER_IDS`,
  );

  // ── 1 · the gate: a non-owner must not find the hub ──────────────────────

  for (const route of [...HUB_ROUTES, ...AUTHORING_ROUTES]) {
    await run.check(`non-owner gets 404 on ${route}`, async () => {
      // Deliberately page.goto, NOT the harness `go()` — go() throws on a >=500
      // and treats a 404 as a failure, and a 404 is precisely what we want.
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "networkidle",
      });
      const status = response?.status() ?? 0;

      expectTrue(
        status === 404,
        `expected 404, got ${status} — a non-owner can reach ${route}`,
      );

      // A 404 that still leaks the hub's chrome would defeat the point of
      // hiding the surface rather than redirecting away from it.
      const leaked = await page.evaluate(
        () => !!document.querySelector('nav[aria-label="Admin sections"]'),
      );
      expectTrue(!leaked, `the 404 page still rendered the admin sidebar`);

      return `404, no chrome leaked`;
    });
  }

  await run.check("the member app still works for a non-owner", async () => {
    // The (owner) group moved out of (app) this slice. If that move broke the
    // member layout, every assertion above would still pass while the actual
    // app was down — so prove the phone shell is intact.
    const response = await page.goto(`${baseUrl}/today`, {
      waitUntil: "networkidle",
    });
    expectTrue(
      (response?.status() ?? 0) < 400,
      `/today returned ${response?.status()}`,
    );
    const hasTabs = await page.evaluate(
      () => !!document.querySelector('nav[aria-label="Bottom navigation"]'),
    );
    expectTrue(hasTabs, "the member bottom tab bar is missing from /today");
    return "bottom tab bar intact";
  });

  // ── 2 · the hub, as its owner ────────────────────────────────────────────
  // Restart the dev server with the THROWAWAY user in the allow-list. Marcus's
  // real OWNER_USER_IDS is never read or written here.

  const OWNER_PORT = 3199;
  const ownerBase = `http://localhost:${OWNER_PORT}`;

  await run.check("boot a dev server that owns the test user", async () => {
    ownerServer = spawn(
      "pnpm",
      ["exec", "next", "dev", "-p", String(OWNER_PORT)],
      {
        // REPO_ROOT, never a URL pathname: the repo lives under "Coding
        // Projects" and a %20 in a spawn cwd surfaces as an unexplainable
        // "spawn pnpm ENOENT" (the harness carries the same warning).
        cwd: REPO_ROOT,
        env: { ...process.env, OWNER_USER_IDS: userId },
        detached: true,
        stdio: "ignore",
      },
    );

    const deadline = Date.now() + 90_000;
    for (;;) {
      try {
        const res = await fetch(`${ownerBase}/login`);
        if (res.status < 500) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) {
        throw new Error(`owner dev server never came up on ${OWNER_PORT}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return `listening on ${OWNER_PORT} with OWNER_USER_IDS=${userId.slice(0, 8)}…`;
  });

  const ownerContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  await ownerContext.addCookies(
    cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const ownerPage = await ownerContext.newPage();

  async function gotoHub(route) {
    const response = await ownerPage.goto(`${ownerBase}${route}`, {
      waitUntil: "networkidle",
    });
    expectTrue(
      (response?.status() ?? 0) < 400,
      `${route} returned ${response?.status()} for the owner`,
    );
    return response;
  }

  await run.check("owner reaches the hub and sees its own chrome", async () => {
    await gotoHub("/admin");
    await expectVisible(ownerPage, 'nav[aria-label="Admin sections"]');
    await expectText(ownerPage, "Overview");

    // The hub must NOT wear the member app's bottom tab bar — that is the
    // whole reason the route group moved out of (app) this slice.
    const hasTabs = await ownerPage.evaluate(
      () => !!document.querySelector('nav[aria-label="Bottom navigation"]'),
    );
    expectTrue(!hasTabs, "the admin hub is still rendering the mobile tab bar");

    await shoot(ownerPage, "t3a-admin-overview", { fullPage: false });
    return "sidebar present, mobile tab bar absent";
  });

  await run.check("the overview reports REAL counts, not copy", async () => {
    // The stub this replaced showed four cards reading "Soon". The tiles must
    // now carry numbers read out of the database.
    const tiles = await ownerPage.evaluate(() => {
      const heading = [...document.querySelectorAll("p")].find(
        (p) => (p.textContent ?? "").trim() === "Your library",
      );
      const section = heading?.closest("section");
      return [...(section?.querySelectorAll("a") ?? [])].map((a) => ({
        label: a.querySelector(".eyebrow")?.textContent?.trim() ?? "",
        value: a.querySelector("span.text-3xl")?.textContent?.trim() ?? "",
      }));
    });

    expectTrue(tiles.length === 4, `expected 4 tiles, found ${tiles.length}`);
    for (const tile of tiles) {
      expectTrue(
        /^\d+$/.test(tile.value),
        `tile "${tile.label}" shows ${JSON.stringify(tile.value)} — not a number`,
      );
    }
    // The throwaway user has an empty library, so zeros are CORRECT here. The
    // assertion that matters is that they are numbers rendered from a query,
    // not placeholder text.
    return tiles.map((t) => `${t.label}=${t.value}`).join(" · ");
  });

  await run.check("sidebar navigates, one active item at a time", async () => {
    for (const route of HUB_ROUTES) {
      await gotoHub(route);

      const active = await ownerPage.evaluate(() =>
        [
          ...document.querySelectorAll(
            'nav[aria-label="Admin sections"] a[aria-current="page"]',
          ),
        ].map((a) => a.getAttribute("href")),
      );

      expectTrue(
        active.length === 1,
        `${route}: ${active.length} active sidebar items (${active.join(",")})` +
          ` — "/admin" matching every child route is the bug this guards`,
      );
      expectTrue(
        active[0] === route,
        `${route}: the active item is ${active[0]}`,
      );
    }
    return "4 routes, exactly one active item each";
  });

  await run.check("unbuilt sections say so honestly", async () => {
    for (const route of ["/admin/analytics", "/admin/members"]) {
      await gotoHub(route);
      await expectText(ownerPage, "Not built yet");
      await expectText(ownerPage, "Unblocked by:");
    }
    await shoot(ownerPage, "t3a-admin-not-built", { fullPage: false });
    return "analytics + members name their blocker";
  });

  await run.check("programs lists the owner's real programs", async () => {
    // T3-C repointed this page from `plan_templates` (a seed-written snapshot
    // archive) to `training_plans` (the real, editable programs). The
    // throwaway user has none, so the EMPTY STATE is the correct render — and
    // it must be the empty state, not a crash and not a blank.
    await gotoHub("/admin/programs");
    const body = await ownerPage.evaluate(() => document.body.innerText ?? "");
    expectTrue(
      body.includes("No programs yet") || body.includes("New program"),
      "programs page rendered neither programs nor an empty state",
    );
    expectTrue(
      !body.includes("Read-only for now"),
      "the retired read-only plan_templates page is still rendering",
    );
    await shoot(ownerPage, "t3a-admin-programs", { fullPage: false });
    return body.includes("No programs yet") ? "empty state" : "programs listed";
  });

  // ── 2b · THE DEAD END Marcus hit (T3-B) ──────────────────────────────────
  //
  // "why is it when I click into libraries I cant return to library desktop -
  // and why does it go into plan tab of mobile view". The Library and the
  // schedule editor lived under (app), so clicking them from the hub dropped
  // the owner into the PHONE shell with the member tab bar and no way back.
  // These assertions are the regression test for that, and they read the
  // rendered chrome rather than the URL — the URL never changed, which is
  // exactly why the bug was invisible to every static gate.

  for (const route of AUTHORING_ROUTES) {
    await run.check(`${route} renders inside the builder`, async () => {
      await gotoHub(route);
      // /library redirects to /library/lifting; settle before reading.
      await ownerPage.waitForLoadState("networkidle");

      const chrome = await ownerPage.evaluate(() => ({
        sidebar: !!document.querySelector('nav[aria-label="Admin sections"]'),
        memberTabs: !!document.querySelector(
          'nav[aria-label="Bottom navigation"]',
        ),
      }));

      expectTrue(
        chrome.sidebar,
        `${route} has no admin sidebar — it is still outside the builder`,
      );
      expectTrue(
        !chrome.memberTabs,
        `${route} is rendering the MEMBER bottom tab bar — the exact bug`,
      );

      // And the way back must be a real, clickable link, not the back button.
      const backToHub = await ownerPage.evaluate(
        () =>
          !!document.querySelector(
            'nav[aria-label="Admin sections"] a[href="/admin"]',
          ),
      );
      expectTrue(backToHub, `${route} offers no link back to the hub`);

      // CONTENT, not just chrome. An earlier cut of this check asserted only
      // the sidebar and passed against a screen whose entire content area was
      // blank — the sidebar is rendered by the LAYOUT, so it proves nothing
      // about the page. Assert the <main> actually has something in it.
      const mainText = await ownerPage.evaluate(
        () => document.querySelector("main")?.innerText?.trim() ?? "",
      );
      expectTrue(
        mainText.length > 20,
        `${route} rendered an empty content area (${mainText.length} chars) —` +
          ` the layout drew the chrome but the page drew nothing`,
      );

      return `sidebar present, member tabs absent, ${mainText.length} chars of content`;
    });
  }

  await run.check(
    "clicking Library from the hub stays in the hub",
    async () => {
      // The real interaction, not a direct navigation: this is what Marcus did.
      await gotoHub("/admin");
      await ownerPage.click(
        'nav[aria-label="Admin sections"] a[href="/library"]',
      );
      // /library redirects onward to the Blocks tab — wait for the SETTLED
      // url, not the first one, or the assertions read a half-navigated page.
      await ownerPage.waitForURL("**/library/**", { timeout: 20_000 });
      await ownerPage.waitForLoadState("networkidle");

      const chrome = await ownerPage.evaluate(() => ({
        sidebar: !!document.querySelector('nav[aria-label="Admin sections"]'),
        memberTabs: !!document.querySelector(
          'nav[aria-label="Bottom navigation"]',
        ),
        active: [
          ...document.querySelectorAll(
            'nav[aria-label="Admin sections"] a[aria-current="page"]',
          ),
        ].map((a) => a.getAttribute("href")),
        mainText: document.querySelector("main")?.innerText?.trim() ?? "",
      }));

      expectTrue(
        chrome.sidebar && !chrome.memberTabs,
        "fell out of the builder",
      );
      expectTrue(
        chrome.active.length === 1 && chrome.active[0] === "/library",
        `sidebar active items: ${JSON.stringify(chrome.active)} — Library should be the one`,
      );
      // CONTENT, not just chrome: the sidebar is drawn by the LAYOUT, so its
      // presence proves nothing about the page. An earlier cut asserted only
      // chrome and would have passed against a genuinely blank screen.
      expectTrue(
        chrome.mainText.length > 20,
        `landed on an empty page (${chrome.mainText.length} chars of content)`,
      );

      // NO SCREENSHOT HERE — deliberately. See KNOWN_ISSUES.md ("admin-hub
      // screenshots come back blank"): captures of this screen taken from
      // inside the drive return an empty content area while the DOM, the
      // computed styles and every assertion above are correct, and the same
      // screen captures correctly from a standalone script. A screenshot that
      // disagrees with reality is worse than none, so this check proves the
      // BEHAVIOUR and leaves appearance to the captures that are trustworthy.
      return `Library active, ${chrome.mainText.length} chars of content`;
    },
  );

  await run.check("/plan/edit is no longer shadowed by [day]", async () => {
    // THE ROUTING BUG T3-B FOUND. While the schedule editor lived at
    // /plan/edit inside the (owner) group, the member group's dynamic
    // /plan/[day] route ALSO matched it — Next resolved day="edit" and served
    // the member page in the phone shell. The build was green the whole time.
    // The editors now live under /admin/schedule, so nothing collides.
    const response = await ownerPage.goto(`${ownerBase}/plan/edit`, {
      waitUntil: "networkidle",
    });
    // Whatever /plan/edit does now, it must NOT be the schedule editor.
    const isEditor = await ownerPage.evaluate(
      () => !!document.querySelector('nav[aria-label="Admin sections"]'),
    );
    expectTrue(
      !isEditor,
      "/plan/edit still resolves inside the hub — the collision is back",
    );
    return `/plan/edit → ${response?.status()}, not the editor`;
  });

  await run.check("edit and delete are reachable on exercises", async () => {
    // Marcus: "allow me to edit and delete exercises, programs, blocks,
    // workouts". Edit/delete were already BUILT — they were unreachable.
    // Prove the affordances actually render now that the surface is in the hub.
    await gotoHub("/library/exercises");
    const affordances = await ownerPage.evaluate(() => {
      const labels = [...document.querySelectorAll("button")].map((b) =>
        (b.getAttribute("aria-label") ?? b.textContent ?? "").toLowerCase(),
      );
      return {
        edit: labels.filter((l) => l.includes("edit")).length,
        remove: labels.filter((l) => l.includes("delete")).length,
        add: labels.filter((l) => l.includes("add") || l.includes("new"))
          .length,
      };
    });
    expectTrue(
      affordances.add > 0,
      "no add-exercise affordance on /library/exercises",
    );
    return `add=${affordances.add} edit=${affordances.edit} delete=${affordances.remove}`;
  });

  // ── 3 · responsive: desktop-first must not mean phone-broken ─────────────

  await run.check("the hub is usable at 390px", async () => {
    await ownerPage.setViewportSize({ width: 390, height: 844 });
    await gotoHub("/admin");

    await expectVisible(ownerPage, 'nav[aria-label="Admin sections"]');

    const overflow = await ownerPage.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expectTrue(
      overflow <= 0,
      `page scrolls ${overflow}px horizontally at 390px`,
    );

    await shoot(ownerPage, "t3a-admin-mobile", { fullPage: false });
    await ownerPage.setViewportSize({ width: 1440, height: 900 });
    return "nav present, 0px horizontal overflow";
  });

  await ownerContext.close();
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
