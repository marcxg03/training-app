// FULL ADMIN-SURFACE AUDIT.
//
// Marcus: "do a full debug and then full run through of the admin surface and
// highlight any issues, or problems with UX".
//
// Run:  node e2e/audit-admin.mjs
//
// This is an AUDIT, not a pass/fail drive. It walks every owner surface with a
// library shaped like Marcus's real one (lifting + cardio + recovery blocks,
// cardio + recovery activities, a catalog workout, a program with sessions) and
// reports FINDINGS: broken things, dead ends, missing affordances, console
// errors, layout overflow. A finding is not automatically a failure — some are
// judgement calls for him — so they are printed with a severity rather than
// silently exiting 1.

import { spawn } from "node:child_process";

import {
  createRun,
  printConsoleReport,
  screenshots,
  shoot,
  startSession,
  REPO_ROOT,
} from "./harness/index.mjs";

const findings = [];
function finding(severity, surface, what, detail = "") {
  findings.push({ severity, surface, what, detail });
}

const run = createRun("ADMIN SURFACE AUDIT");

let session = null;
let cleanedUp = false;
let server = null;

try {
  session = await startSession({ seedData: false, viewport: "desktop" });
  const { userId, browser, cookies, admin: db } = session;

  // ── fixture: a library shaped like Marcus's ──────────────────────────────
  await run.check("seed a realistic library", async () => {
    const { data: ex, error: exErr } = await db
      .from("exercises")
      .insert([
        { user_id: userId, name: "Audit Bench", muscle_groups: ["chest"], is_bodyweight: false, is_compound: true, prescribed_min: 5, prescribed_max: 8 }, // prettier-ignore
        { user_id: userId, name: "Audit Row", muscle_groups: ["back"], is_bodyweight: false, is_compound: true, prescribed_min: 6, prescribed_max: 10 }, // prettier-ignore
      ])
      .select("exercise_id");
    if (exErr) throw new Error(`fixture exercises failed: ${exErr.message}`);

    // EVERY FIXTURE INSERT IS ERROR-CHECKED. The first cut of this audit did
    // not check, `blocks.display_order` is NOT NULL, all three inserts failed
    // silently, and the audit then reported "No cardio block in your Library"
    // as an app BLOCKER when the fixture was the broken thing. An audit that
    // invents findings is worse than no audit.
    const { data: blocks, error: blockErr } = await db
      .from("blocks")
      .insert([
        { owner_user_id: userId, block_name: "Audit Chest", block_category: "lifting", block_type: "failure", display_order: 0 }, // prettier-ignore
        { owner_user_id: userId, block_name: "Audit Cardio", block_category: "cardio", display_order: 1 }, // prettier-ignore
        { owner_user_id: userId, block_name: "Audit Recovery", block_category: "recovery", display_order: 2 }, // prettier-ignore
      ])
      .select("block_id, block_category");
    if (blockErr) throw new Error(`fixture blocks failed: ${blockErr.message}`);

    const { error: cardioErr } = await db.from("cardio_activities").insert([
      { owner_user_id: userId, name: "Audit Run", cardio_format: "endurance_run", cardio_target_zone: "zone_2" }, // prettier-ignore
      { owner_user_id: userId, name: "Audit Bike", cardio_format: "endurance_run", cardio_target_zone: "zone_2" }, // prettier-ignore
    ]);
    if (cardioErr) throw new Error(`fixture cardio failed: ${cardioErr.message}`); // prettier-ignore

    const { error: recErr } = await db
      .from("recovery_activities")
      .insert([{ owner_user_id: userId, name: "Audit Sauna" }]);
    if (recErr) throw new Error(`fixture recovery failed: ${recErr.message}`);

    const lifting = blocks?.find((b) => b.block_category === "lifting");
    if (lifting && ex?.[0]) {
      await db.from("block_exercises").insert({
        block_id: lifting.block_id,
        exercise_id: ex[0].exercise_id,
        display_order: 0,
      });
    }

    const { data: plan } = await db
      .from("training_plans")
      .insert({ user_id: userId, name: "Audit Program", is_active: true })
      .select("plan_id")
      .single();

    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    await db.from("daily_schedules").insert(
      days.map((d) => ({
        plan_id: plan.plan_id,
        day_of_week: d,
        is_rest_day: d === "sun",
      })),
    );

    return `plan ${plan.plan_id.slice(0, 8)}…, 3 blocks, 2 cardio + 1 recovery activity`; // prettier-ignore
  });

  const { data: planRow } = await db
    .from("training_plans")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  const planId = planRow.plan_id;

  const PORT = 3185;
  const base = `http://localhost:${PORT}`;

  await run.check("boot an owner dev server", async () => {
    server = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, OWNER_USER_IDS: userId },
      detached: true,
      stdio: "ignore",
    });
    const deadline = Date.now() + 120_000;
    for (;;) {
      try {
        const r = await fetch(`${base}/login`);
        if (r.status < 500) break;
      } catch {
        /* not up */
      }
      if (Date.now() > deadline) throw new Error("server never came up");
      await new Promise((r) => setTimeout(r, 1000));
    }
    return `on ${PORT}`;
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  await ctx.addCookies(
    cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 120)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) {
      pageErrors.push(m.text().slice(0, 120));
    }
  });

  async function visit(route) {
    const res = await page.goto(`${base}${route}`, {
      waitUntil: "networkidle",
    });
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), {
        timeout: 20_000,
      })
      .catch(() => {});
    return res;
  }

  // ── 1 · every admin surface renders ──────────────────────────────────────
  const SURFACES = [
    ["/admin", "Overview"],
    ["/admin/programs", "Programs"],
    [`/admin/programs/${planId}`, "Program week"],
    [`/admin/programs/${planId}/mon`, "Day editor"],
    ["/admin/nutrition", "Nutrition"],
    ["/admin/analytics", "Analytics"],
    ["/admin/members", "Members"],
    ["/library/lifting", "Library · Blocks"],
    ["/library/workouts", "Library · Workouts"],
    ["/library/exercises", "Library · Exercises"],
    ["/library/cardio", "Library · Cardio"],
    ["/library/recovery", "Library · Recovery"],
  ];

  await run.check("every admin surface renders with content", async () => {
    const broken = [];
    for (const [route, name] of SURFACES) {
      const res = await visit(route);
      const status = res?.status() ?? 0;
      const text = await page.evaluate(() =>
        (document.querySelector("main")?.innerText ?? "").trim(),
      );
      const hasSidebar = await page.evaluate(
        () => !!document.querySelector('nav[aria-label="Admin sections"]'),
      );

      if (status >= 400) {
        broken.push(`${name} → ${status}`);
        finding("BLOCKER", name, `returns ${status}`, route);
      } else if (text.length < 20) {
        broken.push(`${name} → empty`);
        finding("BLOCKER", name, "renders an empty content area", route);
      } else if (!hasSidebar) {
        finding("HIGH", name, "renders OUTSIDE the admin shell (no sidebar)", route); // prettier-ignore
      }
    }
    if (broken.length) {
      throw new Error(broken.join("; "));
    }
    return `${SURFACES.length} surfaces OK`;
  });

  // ── 2 · the reported bug: cardio / recovery on a day ─────────────────────

  await run.check("a NEW session offers all three types", async () => {
    await visit(`/admin/programs/${planId}/tue`);
    await page.getByRole("button", { name: /Add session/i }).first().click(); // prettier-ignore
    await page.waitForTimeout(600);

    // The buttons are CSS-uppercased, so innerText reads "CARDIO" — compare
    // case-insensitively or every type looks missing.
    const types = await page.evaluate(() =>
      [...document.querySelectorAll("main button")]
        .map((b) => (b.innerText || "").trim().toLowerCase())
        .filter((t) => ["lifting", "cardio", "recovery"].includes(t)),
    );

    for (const t of ["lifting", "cardio", "recovery"]) {
      if (!types.includes(t)) {
        finding("BLOCKER", "Day editor", `the "${t}" session type is not offered`); // prettier-ignore
      }
    }
    return `types offered: ${types.join(", ") || "NONE"}`;
  });

  await run.check("a cardio session can pick an activity", async () => {
    await page.getByRole("button", { name: /^Cardio$/i }).first().click(); // prettier-ignore
    await page.waitForTimeout(800);

    const state = await page.evaluate(() => {
      const main = document.querySelector("main");
      const text = main?.innerText ?? "";
      const selects = [...main.querySelectorAll("select")].map((s) => ({
        options: [...s.options].map((o) => o.textContent?.trim()),
      }));
      return {
        saysNoActivities: /No cardio activities/i.test(text),
        saysNoBlock: /No cardio block/i.test(text),
        selects,
      };
    });

    if (state.saysNoActivities) {
      finding("BLOCKER", "Day editor", "cardio says there are no activities though the Library has them"); // prettier-ignore
    }
    if (state.saysNoBlock) {
      finding("BLOCKER", "Day editor", "cardio says there is no cardio block though the Library has one"); // prettier-ignore
    }
    const hasActivityPicker = state.selects.some((s) =>
      s.options.some((o) => (o ?? "").includes("Audit Run")),
    );
    if (!hasActivityPicker) {
      finding("HIGH", "Day editor", "no picker offering the cardio activities", JSON.stringify(state.selects).slice(0, 120)); // prettier-ignore
    }
    // A brand-new row must not shout at the user before they have typed.
    const premature = await page.evaluate(() => {
      const main = document.querySelector("main");
      return [...main.querySelectorAll("p, span")]
        .filter((n) => /text-danger|text-destructive/.test(n.className ?? ""))
        .map((n) => (n.textContent ?? "").trim())
        .filter(Boolean);
    });
    if (premature.length > 0) {
      finding(
        "MEDIUM",
        "Day editor",
        "a brand-new session shows validation errors before anything is typed",
        premature.join(" | "),
      );
    }

    await shoot(page, "audit-day-cardio", { fullPage: false });
    return hasActivityPicker ? "activity picker present" : "NO activity picker";
  });

  await run.check("a recovery session can pick an activity", async () => {
    await page.getByRole("button", { name: /^Recovery$/i }).first().click(); // prettier-ignore
    await page.waitForTimeout(800);

    const ok = await page.evaluate(() =>
      [...document.querySelectorAll("main select")].some(
        (s) =>
        [...s.options].some((o) => (o.textContent ?? "").includes("Audit Sauna")), // prettier-ignore
      ),
    );
    if (!ok) {
      finding("HIGH", "Day editor", "no picker offering the recovery activities"); // prettier-ignore
    }
    return ok ? "activity picker present" : "NO activity picker";
  });

  await run.check("the WEEK editor can reach cardio and recovery", async () => {
    // THE GAP THIS AUDIT ORIGINALLY MISSED. The earlier checks drove the DAY
    // editor by URL, so they proved cardio/recovery work there and never asked
    // how a human GETS there. Marcus found the answer: from the week editor you
    // could not. Its "Add workout" offers only the workout_def catalog, and
    // cardio/recovery sessions have no definition — so the picker showed one
    // lifting workout and nothing else, on a screen whose own copy said "open
    // a day to edit its sessions" while offering no way to open one.
    await visit(`/admin/programs/${planId}`);

    const dayLinks = await page.evaluate(
      () =>
      [...document.querySelectorAll("main a")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => /\/admin\/programs\/[0-9a-f-]{36}\/(mon|tue|wed|thu|fri|sat|sun)$/.test(h)), // prettier-ignore
    );

    if (dayLinks.length === 0) {
      finding(
        "BLOCKER",
        "Week editor",
        "no way to open a day, so cardio and recovery sessions are unreachable",
        'the "Add workout" picker offers only catalog workouts, which cardio/recovery never have',
      );
      return "NO day links";
    }

    if (dayLinks.length < 7) {
      finding("MEDIUM", "Week editor", `only ${dayLinks.length} of 7 days link to their editor`); // prettier-ignore
    }

    // And the door has to actually land on the editable day.
    await page.goto(`${base}${dayLinks[0]}`, { waitUntil: "networkidle" });
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), {
        timeout: 20_000,
      }) // prettier-ignore
      .catch(() => {});
    const landed = await page.evaluate(() =>
      /Add session/i.test(document.querySelector("main")?.innerText ?? ""),
    );
    if (!landed) {
      finding("HIGH", "Week editor", "the day link does not land on an editable day"); // prettier-ignore
    }

    await visit(`/admin/programs/${planId}`);
    await shoot(page, "audit-week-editor", { fullPage: false });
    return `${dayLinks.length}/7 days link to their editor`;
  });

  // ── 3 · the catalog-linked dead end ──────────────────────────────────────

  await run.check(
    "a catalog-linked session offers a way to edit it",
    async () => {
      // Make a catalog-linked session the way the seed does.
      const { data: def } = await db
        .from("workout_defs")
        .insert({
          owner_user_id: userId,
          name: "Audit Catalog Workout",
          workout_type: "lifting",
        }) // prettier-ignore
        .select("workout_def_id")
        .single();
      const { data: sched } = await db
        .from("daily_schedules")
        .select("schedule_id")
        .eq("plan_id", planId)
        .eq("day_of_week", "wed")
        .single();
      await db.from("workouts").insert({
        schedule_id: sched.schedule_id,
        workout_def_id: def.workout_def_id,
        workout_name: "Audit Catalog Workout",
        workout_type: "lifting",
        display_order: 0,
      });

      await visit(`/admin/programs/${planId}/wed`);
      const state = await page.evaluate(() => {
        const main = document.querySelector("main");
        const text = main?.innerText ?? "";
        const links = [...main.querySelectorAll("a")].map((a) => a.getAttribute("href")); // prettier-ignore
        return {
          readOnly: /edit its blocks in the Library/i.test(text),
          linksToLibrary: links.some((h) => (h ?? "").includes("/library")),
        };
      });

      if (state.readOnly && !state.linksToLibrary) {
        finding(
          "HIGH",
          "Day editor",
          'a catalog-linked session says "edit its blocks in the Library" but offers NO link there',
          "dead end — the user has to know the Library exists and find the workout by hand",
        );
      }
      await shoot(page, "audit-day-catalog-linked", { fullPage: false });
      return state.readOnly
        ? `read-only, link to Library: ${state.linksToLibrary}`
        : "editable";
    },
  );

  await run.check(
    "a HISTORY-frozen session explains the way forward",
    async () => {
      // The state Marcus actually hit: 5 of his 9 live sessions carry logged
      // sets, so their composition is frozen. The constraint is correct; being
      // told only "frozen" is not.
      const { data: sched } = await db
        .from("daily_schedules")
        .select("schedule_id")
        .eq("plan_id", planId)
        .eq("day_of_week", "thu")
        .single();
      const { data: w } = await db
        .from("workouts")
        .insert({
          schedule_id: sched.schedule_id,
          workout_name: "Audit Logged Session",
          workout_type: "lifting",
          display_order: 0,
        })
        .select("workout_id")
        .single();

      const { data: blk } = await db
        .from("blocks")
        .select("block_id")
        .eq("owner_user_id", userId)
        .eq("block_category", "lifting")
        .single();
      const { data: exr } = await db
        .from("exercises")
        .select("exercise_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      const { data: sess } = await db
        .from("sessions")
        .insert({
          user_id: userId,
          workout_id: w.workout_id,
          session_date: "2026-09-01",
        }) // prettier-ignore
        .select("session_id")
        .maybeSingle();

      if (sess) {
        await db.from("set_logs").insert({
          user_id: userId,
          session_id: sess.session_id,
          workout_id: w.workout_id,
          block_id: blk.block_id,
          exercise_id: exr.exercise_id,
          set_index: 1,
          reps: 5,
          weight_kg: 60,
          prescribed_min: 5,
          prescribed_max: 8,
        });
      }

      await visit(`/admin/programs/${planId}/thu`);
      const text = await page.evaluate(
        () => document.querySelector("main")?.innerText ?? "",
      );

      if (/frozen/i.test(text)) {
        const explains = /add a new session|new program/i.test(text);
        if (!explains) {
          finding(
            "HIGH",
            "Day editor",
            "a history-frozen session says it is frozen but not what to do instead",
          );
        }
        return explains ? "frozen + explains the way forward" : "frozen, no guidance"; // prettier-ignore
      }
      return "not frozen in this fixture (set_logs insert may have been skipped)";
    },
  );

  // ── 4 · nutrition targets from the admin surface ─────────────────────────

  await run.check("nutrition targets are reachable from admin", async () => {
    const reachable = [];
    for (const [route] of SURFACES) {
      await visit(route);
      const has = await page.evaluate(() =>
        [...document.querySelectorAll("a")].some((a) =>
          (a.getAttribute("href") ?? "").includes("/nutrition"),
        ),
      );
      if (has) reachable.push(route);
    }
    if (reachable.length === 0) {
      finding(
        "HIGH",
        "Admin hub",
        "nutrition targets cannot be reached from ANY admin surface",
        "targets live at /nutrition/targets in the member app; the hub never links there",
      );
    }
    return reachable.length ? `linked from ${reachable.join(", ")}` : "NOT reachable"; // prettier-ignore
  });

  await run.check("no duplicate save/cancel controls on desktop", async () => {
    // Two Saves and two Cancels on one screen makes a user stop and work out
    // whether they do different things. The mobile action bar is hidden at lg.
    await visit(`/admin/programs/${planId}/tue`);
    const counts = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const labels = [...document.querySelectorAll("main button")]
        .filter(visible)
        .map((b) => (b.innerText || "").trim().toLowerCase());
      return {
        save: labels.filter((t) => t.startsWith("save")).length,
        cancel: labels.filter((t) => t === "cancel").length,
      };
    });
    if (counts.save > 1 || counts.cancel > 1) {
      finding(
        "MEDIUM",
        "Day editor",
        `duplicate actions on desktop: ${counts.save} Save, ${counts.cancel} Cancel`,
      );
    }
    return `${counts.save} Save, ${counts.cancel} Cancel`;
  });

  // ── 5 · layout + console health ──────────────────────────────────────────

  await run.check("no horizontal overflow on any surface", async () => {
    const bad = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, name] of SURFACES) {
        await visit(route);
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        if (over > 0) {
          bad.push(`${name}@${width}px +${over}px`);
          finding("MEDIUM", name, `scrolls ${over}px horizontally at ${width}px`); // prettier-ignore
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return bad.length ? bad.join("; ") : "clean at 1440 and 390";
  });

  await run.check("no uncaught page errors across the walk", async () => {
    const unique = [...new Set(pageErrors)];
    for (const err of unique) {
      finding("HIGH", "Console", "uncaught error during the walk", err);
    }
    return unique.length ? `${unique.length} distinct` : "none";
  });

  await ctx.close();
} catch (error) {
  run.record("AUDIT ABORTED", "FAIL", error?.stack ?? String(error));
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
  if (session) {
    try {
      await session.stop();
      cleanedUp = await session.verifyCleanedUp();
    } catch (e) {
      console.error("cleanup error:", e?.message ?? e);
    }
  }
}

run.record(
  "cleanup: throwaway user deleted",
  cleanedUp ? "PASS" : "FAIL",
  cleanedUp ? "no residual auth user" : "USER STILL PRESENT",
);

console.log("\n══════════════════════════════════════════════════════════");
console.log(`FINDINGS (${findings.length})`);
console.log("══════════════════════════════════════════════════════════");
const order = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
for (const f of [...findings].sort(
  (a, b) => order[a.severity] - order[b.severity],
)) {
  // prettier-ignore
  console.log(`\n[${f.severity}] ${f.surface}`);
  console.log(`  ${f.what}`);
  if (f.detail) console.log(`  → ${f.detail}`);
}
if (findings.length === 0) console.log("\n  none");

console.log("\nSCREENSHOTS");
for (const file of screenshots()) console.log(`  ${file}`);

run.report();
process.exit(0);
