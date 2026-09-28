// PRODUCTION SMOKE TEST — drives the deployed app, not localhost.
//
// Run:  node e2e/smoke-prod.mjs [url]
//
// WHY THIS IS SEPARATE FROM THE SLICE DRIVES: those assume a dev server they
// can restart and an OWNER_USER_IDS they can override per-run. Production is
// neither — the allow-list holds Marcus's real id and must not be touched. So
// this asserts the two things only production can answer:
//
//   1. the app is PUBLICLY reachable (no Vercel auth wall) and an
//      unauthenticated visitor is bounced to /login, not into the app;
//   2. a real authenticated NON-OWNER gets the member app and is 404'd out of
//      every owner surface — proving OWNER_USER_IDS is actually set in the
//      production environment, which is the one deploy setting whose absence
//      is silent (a missing allow-list fails CLOSED, so the app looks fine
//      and only the owner is locked out).
//
// It seeds and deletes a throwaway @trainingapp.test user in the SAME Supabase
// project the app uses, exactly like the local drives.

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

import { REPO_ROOT, admin, assertTestUser } from "./harness/env.mjs";

const BASE = (process.argv[2] ?? "https://training-app-ruddy-three.vercel.app").replace(/\/$/, ""); // prettier-ignore
const HOST = new URL(BASE).hostname;

let pass = 0;
let fail = 0;
const results = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    results.push(["PASS", name, detail]);
  } else {
    fail += 1;
    results.push(["FAIL", name, detail]);
  }
}

console.log(`\nPRODUCTION SMOKE — ${BASE}\n`);

// ── 1 · public reachability, unauthenticated ─────────────────────────────

for (const [route, expected] of [
  ["/login", 200],
  ["/manifest.webmanifest", 200],
]) {
  const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
  check(
    `anonymous ${route} → ${expected}`,
    res.status === expected,
    `got ${res.status}`,
  );
}

for (const route of ["/today", "/progress", "/admin", "/library"]) {
  const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  check(
    `anonymous ${route} is bounced to login`,
    res.status === 307 && location.includes("/login"),
    `${res.status} → ${location || "(no location)"}`,
  );
}

// The wall that made the app unusable for months.
const loginHtml = await fetch(`${BASE}/login`).then((r) => r.text());
check(
  "no Vercel authentication wall",
  !/vercel authentication|Log in to Vercel/i.test(loginHtml),
  "",
);
check("it is the Training app", /<title>Training<\/title>/.test(loginHtml), "");

// ── 2 · an authenticated NON-OWNER ───────────────────────────────────────

const seeded = spawnSync(
  process.execPath,
  ["--env-file=.env.local", "e2e/_setup/seed-auth.mjs"],
  { cwd: REPO_ROOT, encoding: "utf8" },
);

if (seeded.status !== 0) {
  console.error("could not seed a test user:", seeded.stderr);
  process.exit(1);
}

const { userId, cookies, email } = JSON.parse(
  seeded.stdout.trim().split("\n").pop(),
);
await assertTestUser(userId);
console.log(`  seeded ${email} (${userId.slice(0, 8)}…)\n`);

const browser = await chromium.launch();
let cleaned = false;

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  });
  // Secure cookies for the real host — not the localhost shape the local
  // harness uses.
  await context.addCookies(
    cookies.map((c) => ({
      ...c,
      domain: HOST,
      path: "/",
      secure: true,
      sameSite: "Lax",
    })),
  );
  const page = await context.newPage();

  const today = await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  check(
    "authenticated member reaches /today",
    (today?.status() ?? 0) < 400,
    `status ${today?.status()}`,
  );
  const hasTabs = await page.evaluate(
    () => !!document.querySelector('nav[aria-label="Bottom navigation"]'),
  );
  check("the member app renders its tab bar", hasTabs, "");

  // THE DEPLOY-CRITICAL ASSERTION. If OWNER_USER_IDS were missing in
  // production, isOwner() fails closed and these 404 for EVERYONE — including
  // Marcus — while the rest of the app looks perfectly healthy.
  for (const route of ["/admin", "/admin/programs", "/library"]) {
    const res = await page.goto(`${BASE}${route}`, {
      waitUntil: "networkidle",
    });
    const leaked = await page.evaluate(
      () => !!document.querySelector('nav[aria-label="Admin sections"]'),
    );
    check(
      `non-owner is 404'd from ${route}`,
      res?.status() === 404 && !leaked,
      `status ${res?.status()}${leaked ? " AND the admin sidebar leaked" : ""}`,
    );
  }

  // The skeletons shipped too. Wrapped: a failure here must not abort the
  // run before the deploy-critical results above are printed.
  try {
    const back = await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
    check(
      "returns to /today after the 404s",
      (back?.status() ?? 0) < 400 && new URL(page.url()).pathname === "/today",
      `status ${back?.status()} at ${page.url()}`,
    );

    const started = Date.now();
    await page
      .locator('nav[aria-label="Bottom navigation"] a[href="/progress"]')
      .first()
      .click({ force: true, timeout: 15_000 });
    await page.waitForFunction(
      () =>
        !!document.querySelector('[aria-busy="true"]') ||
        !!document.querySelector("main h1"),
      { timeout: 15_000 },
    );
    const firstPaint = Date.now() - started;
    check(
      "a tab tap paints quickly in production",
      firstPaint <= 1500,
      `${firstPaint}ms to first paint`,
    );
  } catch (error) {
    check(
      "a tab tap paints quickly in production",
      false,
      String(error?.message ?? error)
        .split("\n")[0]
        .slice(0, 90),
    );
  }

  await context.close();
} finally {
  await browser.close();
  const { error } = await admin().auth.admin.deleteUser(userId);
  cleaned = !error;
}

check("cleanup: throwaway user deleted", cleaned, "");

console.log("RESULT                                              STATUS");
console.log("─".repeat(66));
for (const [status, name, detail] of results) {
  console.log(`${name.padEnd(50)}  ${status}${detail ? `  (${detail})` : ""}`);
}
console.log("─".repeat(66));
console.log(
  `${pass}/${pass + fail} passed${fail ? ` — ${fail} FAILED` : ""}\n`,
);
process.exit(fail ? 1 : 0);
