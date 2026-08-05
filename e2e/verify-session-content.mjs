// Live end-to-end verification of composing a session's CONTENT in the per-day
// plan editor (/plan/[day]/edit) — the workout_blocks membership that decides
// what the logger actually shows.
//
// Proves:
//   1. A lifting session gains an ordered list of Library blocks, persisted to
//      workout_blocks with display_order matching the on-screen order.
//   2. Reordering and removing a block persists.
//   3. A recovery session gains a preset activity, persisted as
//      preset_activity_id + preset_activity_type='recovery' (the table CHECK
//      requires both or neither).
//   4. A brand-new session created in the same save gets its blocks — this is
//      the path that needed saveDay to return the inserted workout_id.
//
// Self-contained: creates a throwaway active plan + Saturday schedule for the
// e2e user, drives it, then tears the plan down (cascade). Run against a dev
// server:
//   pnpm dev &
//   node --env-file=.env.local e2e/_setup/seed-auth.mjs > /tmp/e2e-auth.json
//   node --env-file=.env.local e2e/verify-session-content.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "e2e-slice7b@trainingapp.test";
const PLAN_NAME = "__e2e_session_content__";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DAY = "sat";

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

async function teardown() {
  await admin
    .from("training_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("name", PLAN_NAME);
  // Blocks are global (not plan-scoped), so the plan cascade misses them.
  await admin
    .from("blocks")
    .delete()
    .eq("owner_user_id", user.id)
    .like("block_name", "__e2e %");
}
await teardown(); // idempotent: clears any fixture a prior crash left behind

// Park any real active plan so exactly one plan is active while we drive.
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
const scheduleId = sched.schedule_id;

// The week must keep at least one rest day (hard rule weekRestDayError).
await admin
  .from("daily_schedules")
  .insert({ plan_id: plan.plan_id, day_of_week: "sun", is_rest_day: true });

// Library fixtures owned by the e2e user.
const { data: liftBlocks } = await admin
  .from("blocks")
  .insert([
    {
      owner_user_id: user.id,
      block_name: "__e2e Block Alpha",
      block_category: "lifting",
      block_type: "failure",
      display_order: 900,
    },
    {
      owner_user_id: user.id,
      block_name: "__e2e Block Bravo",
      block_category: "lifting",
      block_type: "failure",
      display_order: 901,
    },
  ])
  .select("block_id, block_name");

const { data: recBlockRows } = await admin
  .from("blocks")
  .select("block_id")
  .eq("owner_user_id", user.id)
  .eq("block_category", "recovery")
  .limit(1);
let recoveryBlockId = recBlockRows?.[0]?.block_id ?? null;
let createdRecoveryBlock = false;
if (!recoveryBlockId) {
  const { data: made } = await admin
    .from("blocks")
    .insert({
      owner_user_id: user.id,
      block_name: "__e2e Recovery",
      block_category: "recovery",
      // block_type DEFAULTS to 'failure'; the blocks_lifting_has_type CHECK
      // requires it NULL on a non-lifting block, so it must be explicit.
      block_type: null,
      display_order: 902,
    })
    .select("block_id")
    .single();
  recoveryBlockId = made.block_id;
  createdRecoveryBlock = true;
}

const { data: recAct } = await admin
  .from("recovery_activities")
  .select("activity_id, name")
  .eq("owner_user_id", user.id)
  .order("name")
  .limit(1);
const recoveryActivity = recAct?.[0] ?? null;

const blocksFor = async (workoutName) => {
  const { data: w } = await admin
    .from("workouts")
    .select("workout_id")
    .eq("schedule_id", scheduleId)
    .eq("workout_name", workoutName)
    .maybeSingle();
  if (!w) return null;
  const { data } = await admin
    .from("workout_blocks")
    .select("block_id, display_order, preset_activity_id, preset_activity_type")
    .eq("workout_id", w.workout_id)
    .order("display_order");
  return data ?? [];
};

const nameOf = (blockId) =>
  (liftBlocks ?? []).find((b) => b.block_id === blockId)?.block_name ?? blockId;

let browser;
try {
  const auth = JSON.parse(readFileSync("/tmp/e2e-auth.json", "utf8"));
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(
    auth.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await page.setViewportSize({ width: 390, height: 844 });

  const openEditor = async () => {
    await page.goto(`${BASE}/plan/${DAY}/edit`, { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Add session" })
      .waitFor({ state: "visible", timeout: 20000 });
  };
  const save = async () => {
    await page
      .getByRole("button", { name: "Save", exact: true })
      .first()
      .click();
    await page.waitForURL(`**/plan/${DAY}`, { timeout: 20000 });
  };
  // .last(): new sessions are appended, so the control being driven belongs to
  // the session just added. .first() would target the day's FIRST session.
  const pickFromSelect = async (triggerName, optionName) => {
    await page.getByRole("combobox", { name: triggerName }).last().click();
    await page.getByRole("option", { name: optionName }).first().click();
  };

  // --- (1) new LIFTING session + two blocks, in one save -------------------
  await openEditor();
  check("UI: editor renders", true);

  await page.getByRole("button", { name: "Add session" }).click();
  await page.getByLabel("Session name").last().fill("__e2e Lift");
  await pickFromSelect("Add block", "__e2e Block Alpha");
  await pickFromSelect("Add block", "__e2e Block Bravo");
  await save();

  let rows = await blocksFor("__e2e Lift");
  check(
    "New lifting session persisted its blocks in order",
    rows?.length === 2 &&
      nameOf(rows[0].block_id) === "__e2e Block Alpha" &&
      nameOf(rows[1].block_id) === "__e2e Block Bravo" &&
      rows[0].display_order === 0 &&
      rows[1].display_order === 1,
    rows
      ? `${rows.length} rows: ${rows.map((r) => nameOf(r.block_id)).join(", ")}`
      : "no workout",
  );
  check(
    "Lifting blocks carry no preset activity",
    (rows ?? []).every(
      (r) => r.preset_activity_id === null && r.preset_activity_type === null,
    ),
  );

  // --- (2) reorder: move Bravo up ------------------------------------------
  await openEditor();
  await page.getByRole("button", { name: "Move __e2e Block Bravo up" }).click();
  await save();

  rows = await blocksFor("__e2e Lift");
  check(
    "Reorder persisted (Bravo now first)",
    rows?.length === 2 && nameOf(rows[0].block_id) === "__e2e Block Bravo",
    rows ? rows.map((r) => nameOf(r.block_id)).join(", ") : "no workout",
  );

  // --- (3) remove one block -------------------------------------------------
  await openEditor();
  await page.getByRole("button", { name: "Remove __e2e Block Alpha" }).click();
  await save();

  rows = await blocksFor("__e2e Lift");
  check(
    "Removal persisted (one block left)",
    rows?.length === 1 && nameOf(rows[0].block_id) === "__e2e Block Bravo",
    rows ? rows.map((r) => nameOf(r.block_id)).join(", ") : "no workout",
  );

  // --- (4) RECOVERY session with a preset activity -------------------------
  if (!recoveryActivity) {
    check("Recovery activity fixture available", false, "none for e2e user");
  } else {
    await openEditor();
    await page.getByRole("button", { name: "Add session" }).click();
    await page.getByRole("button", { name: "Recovery" }).last().click();
    await page.getByLabel("Session name").last().fill("__e2e Recovery Session");
    await pickFromSelect("Activity", recoveryActivity.name);
    await save();

    rows = await blocksFor("__e2e Recovery Session");
    check(
      "Recovery session persisted its preset activity",
      rows?.length === 1 &&
        rows[0].preset_activity_id === recoveryActivity.activity_id &&
        rows[0].preset_activity_type === "recovery",
      rows ? JSON.stringify(rows[0]) : "no workout",
    );
    check(
      "Recovery session attached the recovery-category block",
      rows?.length === 1 && rows[0].block_id === recoveryBlockId,
    );
  }

  // --- (4b) the read surface actually shows it ------------------------------
  // Closes the loop: the editor's write must reach what the app renders, not
  // just the table. /plan/[day] is the same projection the logger reads from.
  await page.goto(`${BASE}/plan/${DAY}`, { waitUntil: "networkidle" });
  const dayBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check(
    "Day view renders the attached block",
    dayBody.includes("__e2e Block Bravo"),
    dayBody.slice(0, 160),
  );
  if (recoveryActivity) {
    check(
      "Day view renders the recovery session's activity",
      dayBody.includes(recoveryActivity.name),
      recoveryActivity.name,
    );
  }

  // --- (4c) reordering a SESSION does not swap block lists ------------------
  // The block editor is a nested useFieldArray bound to
  // `workouts.${workoutIndex}.blocks`; moving a session changes that index on a
  // live instance. If the binding went stale, two sessions' content would swap
  // — and because the write is delete-then-insert, both lists would be lost.
  await openEditor();
  await page.getByRole("button", { name: "Add session" }).click();
  await page.getByLabel("Session name").last().fill("__e2e Lift Two");
  await pickFromSelect("Add block", "__e2e Block Alpha");
  await save();

  await openEditor();
  await page
    .getByRole("button", { name: "Move up", exact: true })
    .last()
    .click();
  await save();

  const lift1 = await blocksFor("__e2e Lift");
  const lift2 = await blocksFor("__e2e Lift Two");
  check(
    "Reordering sessions keeps each session's own blocks",
    lift1?.length === 1 &&
      nameOf(lift1[0].block_id) === "__e2e Block Bravo" &&
      lift2?.length === 1 &&
      nameOf(lift2[0].block_id) === "__e2e Block Alpha",
    `lift1=${(lift1 ?? []).map((r) => nameOf(r.block_id)).join(",")} lift2=${(lift2 ?? []).map((r) => nameOf(r.block_id)).join(",")}`,
  );

  // --- (4d) a LOGGED session's blocks are frozen ----------------------------
  // /history reports blocks_completed_count from the frozen completed_block_ids
  // but blocks_total_count from LIVE workout_blocks, so rewriting a logged
  // session's blocks retroactively corrupts every past completion of it.
  {
    const { data: lifted } = await admin
      .from("workouts")
      .select("workout_id")
      .eq("schedule_id", scheduleId)
      .eq("workout_name", "__e2e Lift Two")
      .single();
    await admin.from("workout_completions").insert({
      user_id: user.id,
      workout_id: lifted.workout_id,
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      completed_at: new Date().toISOString(),
      completed_block_ids: [],
    });

    await openEditor();
    const frozen = await page
      .getByText("This session has logged history, so its blocks are frozen.")
      .count();
    check(
      "Logged session renders its blocks read-only",
      frozen === 1,
      `${frozen} notices`,
    );

    const removeAlpha = await page
      .getByRole("button", { name: "Remove __e2e Block Alpha" })
      .count();
    check(
      "Logged session exposes no block Remove control",
      removeAlpha === 0,
      `${removeAlpha} remove buttons`,
    );

    const after = await blocksFor("__e2e Lift Two");
    check(
      "Logged session kept its block snapshot",
      after?.length === 1 && nameOf(after[0].block_id) === "__e2e Block Alpha",
      (after ?? []).map((r) => nameOf(r.block_id)).join(","),
    );
    await admin
      .from("workout_completions")
      .delete()
      .eq("workout_id", lifted.workout_id);
  }

  // --- (5) editing an unrelated field leaves blocks untouched ---------------
  await openEditor();
  await page.getByLabel("Gym").first().fill("__e2e gym");
  await save();

  rows = await blocksFor("__e2e Lift");
  check(
    "Renaming/gym edit did not disturb block membership",
    rows?.length === 1 && nameOf(rows[0].block_id) === "__e2e Block Bravo",
    rows ? rows.map((r) => nameOf(r.block_id)).join(", ") : "no workout",
  );
} finally {
  if (browser) await browser.close();
  await teardown();
  if (liftBlocks?.length) {
    await admin
      .from("blocks")
      .delete()
      .in(
        "block_id",
        liftBlocks.map((b) => b.block_id),
      );
  }
  if (createdRecoveryBlock && recoveryBlockId) {
    await admin.from("blocks").delete().eq("block_id", recoveryBlockId);
  }
  await restore();
  check("Teardown: fixtures removed + prior active plan restored", true);
}

const failed = checks.filter((c) => !c.ok);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed`,
);
if (failed.length) process.exit(1);
