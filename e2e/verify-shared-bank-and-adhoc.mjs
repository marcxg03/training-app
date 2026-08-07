// Live end-to-end verification of two things:
//
//   A. SHARED EXERCISE BANKS (migration 024). Several blocks can point at one
//      block as the owner of their exercise list, so the same muscle group can
//      occupy several slots in a session without maintaining several banks.
//      Proves resolution reaches the logger, and that the DB refuses chains.
//
//   B. AD-HOC EXERCISES. An exercise can be added to a block mid-session
//      WITHOUT touching the plan: block_lifting_items must be unchanged, the
//      set must persist against the chosen exercise, and the exercise must
//      still be selectable after a reload.
//
// Self-contained: builds a throwaway active plan for the e2e user on TODAY's
// weekday (the logger only opens today's workout), drives it, tears it down.
//   pnpm dev &
//   node --env-file=.env.local e2e/_setup/seed-auth.mjs > /tmp/e2e-auth.json
//   node --env-file=.env.local e2e/verify-shared-bank-and-adhoc.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "e2e-slice7b@trainingapp.test";
const PLAN_NAME = "__e2e_bank_adhoc__";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

if (!URL || !SERVICE) throw new Error("missing supabase env");
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`,
  );
};

const { data: list } = await admin.auth.admin.listUsers();
const user = list.users.find((u) => u.email === EMAIL);
if (!user) throw new Error("e2e user not found");

// The logger only opens a workout scheduled for the app-day, in the profile's
// timezone. Read it the same way the app does rather than guessing.
const { data: profile } = await admin
  .from("profiles")
  .select("timezone")
  .eq("user_id", user.id)
  .maybeSingle();
const tz = profile?.timezone || "America/Chicago";
const shortDay = new Intl.DateTimeFormat("en-US", {
  timeZone: tz,
  weekday: "short",
}).format(new Date());
const DAY = shortDay.toLowerCase();
const REST_DAY = DAY === "sun" ? "sat" : "sun";

async function teardown() {
  await admin
    .from("training_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("name", PLAN_NAME);
  await admin
    .from("blocks")
    .delete()
    .eq("owner_user_id", user.id)
    .like("block_name", "__e2e %");
  await admin
    .from("exercises")
    .delete()
    .eq("user_id", user.id)
    .like("name", "__e2e %");
}
await teardown();

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

let browser;
try {
  // --- fixtures -------------------------------------------------------------
  const { data: exercises } = await admin
    .from("exercises")
    .insert([
      {
        user_id: user.id,
        name: "__e2e Bench",
        prescribed_min: 6,
        prescribed_max: 8,
      },
      {
        user_id: user.id,
        name: "__e2e Fly",
        prescribed_min: 10,
        prescribed_max: 12,
      },
      {
        user_id: user.id,
        name: "__e2e Offplan Raise",
        prescribed_min: 12,
        prescribed_max: 15,
      },
    ])
    .select("exercise_id, name");
  const exByName = Object.fromEntries(
    (exercises ?? []).map((e) => [e.name, e.exercise_id]),
  );

  const { data: madeBlocks } = await admin
    .from("blocks")
    .insert([
      {
        owner_user_id: user.id,
        block_name: "__e2e Chest R1",
        block_category: "lifting",
        block_type: "failure",
        display_order: 800,
      },
      {
        owner_user_id: user.id,
        block_name: "__e2e Chest R2",
        block_category: "lifting",
        block_type: "failure",
        display_order: 801,
      },
    ])
    .select("block_id, block_name");
  const blockByName = Object.fromEntries(
    (madeBlocks ?? []).map((b) => [b.block_name, b.block_id]),
  );
  const R1 = blockByName["__e2e Chest R1"];
  const R2 = blockByName["__e2e Chest R2"];

  // Only R1 owns a bank; R2 sources from it.
  await admin.from("block_lifting_items").insert([
    { block_id: R1, exercise_id: exByName["__e2e Bench"], display_order: 0 },
    { block_id: R1, exercise_id: exByName["__e2e Fly"], display_order: 1 },
  ]);
  const { error: linkError } = await admin
    .from("blocks")
    .update({ bank_source_block_id: R1 })
    .eq("block_id", R2);
  check(
    "DB: a block can source its bank from another",
    !linkError,
    linkError?.message,
  );

  // --- the one-level guard --------------------------------------------------
  const { error: chainError } = await admin
    .from("blocks")
    .update({ bank_source_block_id: R2 })
    .eq("block_id", R1);
  check(
    "DB: a chain of bank sources is rejected",
    !!chainError,
    chainError?.message?.slice(0, 60),
  );

  const { error: selfError } = await admin
    .from("blocks")
    .update({ bank_source_block_id: R1 })
    .eq("block_id", R1);
  check(
    "DB: a block cannot source its bank from itself",
    !!selfError,
    selfError?.code,
  );

  // --- plan wiring ----------------------------------------------------------
  const { data: plan } = await admin
    .from("training_plans")
    .insert({ user_id: user.id, name: PLAN_NAME, is_active: true })
    .select("plan_id")
    .single();
  const { data: sched } = await admin
    .from("daily_schedules")
    .insert({ plan_id: plan.plan_id, day_of_week: DAY, is_rest_day: false })
    .select("schedule_id")
    .single();
  await admin.from("daily_schedules").insert({
    plan_id: plan.plan_id,
    day_of_week: REST_DAY,
    is_rest_day: true,
  });

  const { data: workout } = await admin
    .from("workouts")
    .insert({
      schedule_id: sched.schedule_id,
      workout_type: "lifting",
      workout_name: "__e2e Upper",
      timing: "anytime",
      display_order: 0,
    })
    .select("workout_id")
    .single();

  // The FOLLOWER goes first so the logger opens on it: the exercise picker only
  // renders for the current block, so this is the only arrangement that proves
  // bank resolution actually reaches the UI.
  await admin.from("workout_blocks").insert([
    { workout_id: workout.workout_id, block_id: R2, display_order: 0 },
    { workout_id: workout.workout_id, block_id: R1, display_order: 1 },
  ]);

  // --- drive the logger -----------------------------------------------------
  const auth = JSON.parse(readFileSync("/tmp/e2e-auth.json", "utf8"));
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(
    auth.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.setViewportSize({ width: 390, height: 844 });

  // Waits on the session heading, not "Add exercise" — that control is hidden
  // once a set is logged, which is exactly the state the reload check needs.
  const openLogger = async () => {
    await page.goto(`${BASE}/log/${workout.workout_id}`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("heading", { name: "__e2e Upper" })
      .waitFor({ state: "visible", timeout: 20000 });
  };

  await openLogger();
  const body = () =>
    page
      .locator("body")
      .innerText()
      .then((t) => t.replace(/\s+/g, " "));

  // A. the CURRENT block is the follower — its picker must list the source's
  // bank. A whole-page check would pass on the heading alone, so assert on the
  // picker's own exercise list.
  const pickerText = (await page.getByRole("list").first().innerText()).replace(
    /\s+/g,
    " ",
  );
  check(
    "Logger: follower block's picker lists the source's bank",
    pickerText.includes("__e2e Bench") && pickerText.includes("__e2e Fly"),
    pickerText.slice(0, 160),
  );

  // B. add an off-plan exercise from the bank, mid-session
  await page.getByRole("button", { name: "Add exercise" }).first().click();
  await page
    .getByRole("button", { name: "__e2e Offplan Raise" })
    .first()
    .click();
  check("Logger: off-plan exercise selectable after adding", true);

  // log a set against it
  await page.getByLabel("Weight in pounds").first().fill("50");
  await page.getByLabel("Reps", { exact: true }).first().fill("12");
  await page.getByRole("button", { name: "Log Set" }).first().click();
  await page.waitForTimeout(2500);

  const { data: logged } = await admin
    .from("set_logs")
    .select("exercise_id, block_id")
    .eq("workout_id", workout.workout_id);
  check(
    "Set persisted against the off-plan exercise",
    (logged ?? []).some(
      (r) =>
        r.exercise_id === exByName["__e2e Offplan Raise"] && r.block_id === R2,
    ),
    JSON.stringify(logged ?? []),
  );

  // C. the PLAN is untouched — this is the whole point
  const { data: bankAfter } = await admin
    .from("block_lifting_items")
    .select("exercise_id")
    .eq("block_id", R1);
  const { data: followerBank } = await admin
    .from("block_lifting_items")
    .select("exercise_id")
    .eq("block_id", R2);
  check(
    "Plan untouched: shared bank still holds exactly its 2 planned exercises",
    (bankAfter ?? []).length === 2 &&
      !(bankAfter ?? []).some(
        (r) => r.exercise_id === exByName["__e2e Offplan Raise"],
      ) &&
      (followerBank ?? []).length === 0,
    `source=${(bankAfter ?? []).length} rows, follower=${(followerBank ?? []).length} rows`,
  );

  // D. it survives a reload (page unions session set_logs back in)
  await openLogger();
  const afterReload = await body();
  check(
    "Off-plan exercise still shown after reload",
    afterReload.includes("__e2e Offplan Raise"),
    afterReload.slice(0, 150),
  );
} finally {
  if (browser) await browser.close();
  await teardown();
  await restore();
  check("Teardown: fixtures removed + prior active plan restored", true);
}

const failed = checks.filter((c) => !c.ok);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed`,
);
if (failed.length) process.exit(1);
