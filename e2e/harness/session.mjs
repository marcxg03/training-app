// startSession() / stop() — the whole authenticated-browser lifecycle in two
// calls.
//
// What it guarantees:
//   • a dev server is listening on :3111 (starts one if not, and only kills
//     the one it started — a hand-run `pnpm dev` is left alone)
//   • a confirmed throwaway @trainingapp.test user exists, with a Supabase SSR
//     session injected as cookies — no login form, no email round-trip
//   • (optionally) that user has realistic training data: set_logs, meals,
//     targets, workout_completions, and pr_history
//   • console errors and page errors are captured from the first navigation
//   • stop() ALWAYS deletes the test user (call it in a finally)

import { spawn } from "node:child_process";
import { chromium } from "playwright";

import { attachConsoleCapture, createSink } from "./console.mjs";
import { BASE_URL, PORT, REPO_ROOT, admin, assertTestUser } from "./env.mjs";
import { VIEWPORTS } from "./shoot.mjs";

const SETUP = `${REPO_ROOT}/e2e/_setup`;

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--env-file=.env.local", script, ...args],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );

    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${script.replace(REPO_ROOT + "/", "")} exited ${code}\n${err || out}`,
          ),
        );
        return;
      }

      resolve(out.trim());
    });
  });
}

/** Last line of a script's stdout, parsed as JSON. The seed scripts print a
 * single JSON line; anything they log before it is diagnostics. */
function lastJson(stdout) {
  const lines = stdout.split("\n").filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      /* keep walking back */
    }
  }

  throw new Error(`No JSON line in output:\n${stdout}`);
}

async function probe(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.status;
  } catch {
    return 0;
  }
}

/** 200 on /login is the readiness signal — it is the only page that renders
 * without a session, so it proves the server compiled AND can reach Supabase. */
async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await probe(`${BASE_URL}/login`);

    if (status === 200) {
      return true;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return false;
}

async function ensureServer(log) {
  if (await waitForServer(3000)) {
    log(`dev server already up on ${BASE_URL}`);
    return null;
  }

  log(`starting next dev on :${PORT} …`);
  const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  if (!(await waitForServer(180_000))) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    throw new Error(
      `dev server never answered 200 on ${BASE_URL}/login within 180s`,
    );
  }

  log(`dev server ready on ${BASE_URL}`);
  return child;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.seedData=true]  seed analytics + PR fixtures
 * @param {"mobile"|"desktop"} [opts.viewport="mobile"]
 * @param {boolean} [opts.headless=true]
 * @param {number}  [opts.slowMo=0]
 */
export async function startSession(opts = {}) {
  const {
    seedData = true,
    viewport = "mobile",
    headless = process.env.E2E_HEADED !== "1",
    slowMo = Number(process.env.E2E_SLOWMO ?? 0),
    quiet = false,
  } = opts;

  const log = (message) => {
    if (!quiet) {
      console.log(`  · ${message}`);
    }
  };

  const devServer = await ensureServer(log);

  const auth = lastJson(await runNode(`${SETUP}/seed-auth.mjs`));
  await assertTestUser(auth.userId);
  log(`test user ${auth.email} (${auth.userId.slice(0, 8)}…)`);

  await runNode(`${SETUP}/prep-profile.mjs`, [auth.userId]);

  let seed = null;

  if (seedData) {
    const analytics = await runNode(`${SETUP}/seed-analytics-data.mjs`, [
      auth.userId,
    ]);
    log(analytics.split("\n").pop());
    seed = lastJson(
      await runNode(`${SETUP}/seed-pr-history.mjs`, [auth.userId]),
    );
    log(
      `seeded ${seed.prs} PRs (${seed.weightPRs} weight / ${seed.repPRs} rep) across ${seed.completions} completions`,
    );
  }

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport] ?? VIEWPORTS.mobile,
    // The app's <html> has no forced theme; pin it so screenshots across runs
    // are comparable.
    colorScheme: "light",
  });
  await context.addCookies(
    auth.cookies.map((cookie) => ({
      ...cookie,
      domain: "localhost",
      path: "/",
    })),
  );

  const consoleSink = createSink();
  const page = await context.newPage();
  attachConsoleCapture(page, consoleSink);

  let stopped = false;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;

    try {
      await browser.close();
    } catch {
      /* already closed */
    }

    // Cleanup runs even if the browser blew up — deleting the auth user
    // cascades to every row it owns.
    try {
      const out = await runNode(`${SETUP}/cleanup-auth.mjs`);
      log(out.split("\n").join(" | "));
    } catch (error) {
      console.error(`  !! CLEANUP FAILED: ${error.message}`);
      throw error;
    }

    if (devServer) {
      try {
        process.kill(-devServer.pid, "SIGTERM");
        log("stopped the dev server this run started");
      } catch {
        /* already gone */
      }
    }
  }

  /** Did cleanup actually remove the user? Call AFTER stop(). */
  async function verifyCleanedUp() {
    const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
    return !(data?.users ?? []).some((user) => user.email === auth.email);
  }

  async function setViewport(name) {
    const spec = VIEWPORTS[name];

    if (!spec) {
      throw new Error(`Unknown viewport "${name}"`);
    }

    await page.setViewportSize(spec);
  }

  /**
   * goto + wait for the app shell, with the networkidle the RSC payload needs.
   *
   * A >=500 response throws HERE rather than surfacing three assertions later
   * as "element never became visible" — the most common way a drive wastes an
   * hour. (In `next dev` a `MODULE_NOT_FOUND ./1234.js` in the server log means
   * a stale .next: stop the server, `rm -rf .next`, start again.)
   */
  async function go(pathname, waitFor) {
    const response = await page.goto(`${BASE_URL}${pathname}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    const status = response?.status() ?? 0;

    if (status >= 500) {
      throw new Error(
        `navigation FAILED: GET ${pathname} returned ${status} — check the dev-server log for the server-side stack`,
      );
    }

    if (waitFor) {
      await page
        .locator(waitFor)
        .first()
        .waitFor({ state: "visible", timeout: 20_000 });
    }

    return page;
  }

  return {
    page,
    context,
    browser,
    userId: auth.userId,
    email: auth.email,
    cookies: auth.cookies,
    baseUrl: BASE_URL,
    seed,
    console: consoleSink,
    admin: admin(),
    go,
    setViewport,
    stop,
    verifyCleanedUp,
  };
}
