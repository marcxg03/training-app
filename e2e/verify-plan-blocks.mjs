// Live end-to-end verification of adding/deleting cardio + recovery sessions in
// the per-day plan editor (/plan/[day]/edit).
//
// Proves three layers:
//   1. DB   — the workouts CHECK/enum accept a recovery row (cardio fields NULL)
//             and a cardio row (cardio_format set), and REJECT a cardio row with
//             no format (the constraint the old lifting-only code was avoiding).
//   2. UI    — the editor's new "Add session" → Type picker (+ Cardio format) can
//             create a recovery and a cardio session through the real page.
//   3. Delete — both new sessions can be removed through the UI.
//
// Self-contained: creates a throwaway active plan + Monday schedule for the e2e
// user, drives it, then tears the plan down (cascade). Run against a dev server:
//   pnpm dev &                     # http://localhost:3000
//   node --env-file=.env.local e2e/_setup/seed-auth.mjs > /tmp/e2e-auth.json
//   node --env-file=.env.local e2e/verify-plan-blocks.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "e2e-slice7b@trainingapp.test";
const PLAN_NAME = "__e2e_plan_blocks__";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`,
  );
};

// --- resolve user + a clean fixture ---------------------------------------
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = list.users.find((u) => u.email === EMAIL);
if (!user) throw new Error("e2e user not found");

async function teardown() {
  await admin
    .from("training_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("name", PLAN_NAME);
}
await teardown(); // idempotent: clear any prior fixture

// The editor loads THE active plan via .maybeSingle() (errors on >1), so our
// fixture must be the sole active plan. Deactivate the user's other active
// plans for the duration of the drive; restore() puts them back in teardown.
const { data: priorActive } = await admin
  .from("training_plans")
  .select("plan_id")
  .eq("user_id", user.id)
  .eq("is_active", true);
const priorActiveIds = (priorActive ?? []).map((p) => p.plan_id);
if (priorActiveIds.length) {
  await admin
    .from("training_plans")
    .update({ is_active: false })
    .in("plan_id", priorActiveIds);
}
async function restore() {
  if (priorActiveIds.length) {
    await admin
      .from("training_plans")
      .update({ is_active: true })
      .in("plan_id", priorActiveIds);
  }
}

const { data: plan, error: planErr } = await admin
  .from("training_plans")
  .insert({ user_id: user.id, name: PLAN_NAME, is_active: true })
  .select("plan_id")
  .single();
if (planErr) throw new Error("fixture plan insert failed: " + planErr.message);

const { data: sched, error: schErr } = await admin
  .from("daily_schedules")
  .insert({ plan_id: plan.plan_id, day_of_week: "mon", is_rest_day: false })
  .select("schedule_id")
  .single();
if (schErr)
  throw new Error("fixture schedule insert failed: " + schErr.message);
const scheduleId = sched.schedule_id;

// The week must keep at least one rest day (hard rule weekRestDayError), else the
// Monday editor's Save is blocked. Give the fixture a Sunday rest day.
await admin
  .from("daily_schedules")
  .insert({ plan_id: plan.plan_id, day_of_week: "sun", is_rest_day: true });

const workoutsOnDay = async () =>
  (
    await admin
      .from("workouts")
      .select("workout_name, workout_type, cardio_format")
      .eq("schedule_id", scheduleId)
  ).data ?? [];

try {
  // --- Layer 1: DB accepts recovery + cardio, rejects cardio w/o format -----
  const rec = await admin.from("workouts").insert({
    schedule_id: scheduleId,
    workout_name: "__db_recovery__",
    workout_type: "recovery",
    timing: "anytime",
    display_order: 0,
  });
  check(
    "DB: recovery insert (cardio fields NULL) accepted",
    !rec.error,
    rec.error?.message,
  );

  const car = await admin.from("workouts").insert({
    schedule_id: scheduleId,
    workout_name: "__db_cardio__",
    workout_type: "cardio",
    cardio_format: "endurance_run",
    timing: "anytime",
    display_order: 1,
  });
  check(
    "DB: cardio insert (with format) accepted",
    !car.error,
    car.error?.message,
  );

  const bad = await admin.from("workouts").insert({
    schedule_id: scheduleId,
    workout_name: "__db_cardio_noformat__",
    workout_type: "cardio",
    timing: "anytime",
    display_order: 2,
  });
  check(
    "DB: cardio insert WITHOUT format rejected by CHECK",
    !!bad.error,
    bad.error?.code,
  );

  const seeded = await workoutsOnDay();
  check(
    "DB: recovery row stored with NULL format",
    seeded.some(
      (w) => w.workout_type === "recovery" && w.cardio_format === null,
    ),
  );
  check(
    "DB: cardio row stored with endurance_run format",
    seeded.some(
      (w) => w.workout_type === "cardio" && w.cardio_format === "endurance_run",
    ),
  );

  // reset the schedule so the UI drive starts from zero rows
  await admin.from("workouts").delete().eq("schedule_id", scheduleId);

  // --- Layer 2 + 3: drive the real page -------------------------------------
  const auth = JSON.parse(readFileSync("/tmp/e2e-auth.json", "utf8"));
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(
    auth.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.setViewportSize({ width: 390, height: 844 });

  const openEditor = async () => {
    await page.goto(`${BASE}/plan/mon/edit`, { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Add session" })
      .waitFor({ state: "visible", timeout: 15000 });
  };
  const save = async () => {
    await page
      .getByRole("button", { name: "Save", exact: true })
      .first()
      .click();
    await page.waitForURL("**/plan/mon", { timeout: 15000 });
  };

  // (a) add a RECOVERY session through the UI
  await openEditor();
  check("UI: editor renders with 'Add session'", true);
  await page.getByRole("button", { name: "Add session" }).click();
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await page.getByLabel("Session name").last().fill("__ui_recovery__");
  await save();
  let rows = await workoutsOnDay();
  check(
    "UI: recovery session persisted (type=recovery)",
    rows.some(
      (w) =>
        w.workout_name === "__ui_recovery__" && w.workout_type === "recovery",
    ),
  );
  await page.screenshot({
    path: "/tmp/shot-plan-recovery.png",
    fullPage: true,
  });

  // (b) add a CARDIO session through the UI (Type=Cardio reveals format picker)
  await openEditor();
  await page.getByRole("button", { name: "Add session" }).click();
  await page.getByRole("button", { name: "Cardio", exact: true }).click();
  const fmt = page.getByRole("button", { name: "Endurance run", exact: true });
  check(
    "UI: Cardio format picker appears when Type=Cardio",
    await fmt.isVisible(),
  );
  await fmt.click();
  await page.getByLabel("Session name").last().fill("__ui_cardio__");
  await save();
  rows = await workoutsOnDay();
  check(
    "UI: cardio session persisted (type=cardio, endurance_run)",
    rows.some(
      (w) =>
        w.workout_name === "__ui_cardio__" &&
        w.workout_type === "cardio" &&
        w.cardio_format === "endurance_run",
    ),
  );
  await page.screenshot({ path: "/tmp/shot-plan-cardio.png", fullPage: true });

  // (c) DELETE both sessions through the UI
  await openEditor();
  for (let i = 0; i < 6; i += 1) {
    const btn = page.getByRole("button", { name: "Remove session" }).first();
    if (!(await btn.count()) || !(await btn.isEnabled())) break;
    await btn.click();
  }
  await save();
  rows = await workoutsOnDay();
  check(
    "UI: both sessions deleted (0 remain)",
    rows.length === 0,
    `${rows.length} left`,
  );

  await browser.close();
} finally {
  await teardown();
  await restore();
  const gone =
    (
      await admin
        .from("training_plans")
        .select("plan_id")
        .eq("user_id", user.id)
        .eq("name", PLAN_NAME)
    ).data ?? [];
  check(
    "Teardown: throwaway plan removed + prior active plan restored",
    gone.length === 0,
  );
}

const failed = checks.filter((c) => !c.ok);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed`,
);
process.exit(failed.length ? 1 : 0);
