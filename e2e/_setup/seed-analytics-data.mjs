// Seeds the e2e test user with realistic training + nutrition data so the
// Trends charts can be verified with real rendering (not just empty states).
// Idempotent: wipes the test user's rows first. RLS is bypassed via the
// service role, but everything is scoped to the passed userId (the e2e user),
// so Marcus's own data is never touched.
//
// Run: node --env-file=.env.local e2e/_setup/seed-analytics-data.mjs <userId>
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!URL || !SERVICE || !userId) {
  console.error("Usage: node --env-file=.env.local seed-analytics-data.mjs <userId>");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// SAFETY GATE: this script DELETEs with the service role (RLS bypassed).
// Refuse to run against anything but a confirmed e2e test account, so a
// fat-fingered userId can never wipe real training history.
{
  const { data: target, error } = await admin.auth.admin.getUserById(userId);
  if (error || !target?.user?.email?.endsWith("@trainingapp.test")) {
    console.error(
      `Refusing to seed: user ${userId} is not an @trainingapp.test e2e account` +
        (error ? ` (${error.message})` : ` (email: ${target?.user?.email})`),
    );
    process.exit(1);
  }
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) {
    console.error(`${label} failed:`, error.message);
    process.exit(1);
  }
  return data;
}

// --- wipe previous seed data for this user (FK order) ---
for (const table of [
  "set_logs",
  "workout_completions",
  "pr_history",
  "meal_entries",
]) {
  await must(admin.from(table).delete().eq("user_id", userId), `wipe ${table}`);
}
// junction tables (workout_blocks, block_lifting_items) have no user_id and
// are cleaned via ON DELETE CASCADE from blocks/workouts/plans below
await must(admin.from("blocks").delete().eq("owner_user_id", userId), "wipe blocks");
await must(admin.from("exercises").delete().eq("user_id", userId), "wipe exercises");
await must(admin.from("training_plans").delete().eq("user_id", userId), "wipe plans");

// --- plan structure (minimal FK chain for set_logs) ---
const plan = await must(
  admin
    .from("training_plans")
    .insert({ user_id: userId, name: "E2E Analytics Plan" })
    .select("plan_id")
    .single(),
  "insert plan",
);

const schedule = await must(
  admin
    .from("daily_schedules")
    .insert({ plan_id: plan.plan_id, day_of_week: "mon" })
    .select("schedule_id")
    .single(),
  "insert schedule",
);

const workout = await must(
  admin
    .from("workouts")
    .insert({
      schedule_id: schedule.schedule_id,
      workout_type: "lifting",
      workout_name: "E2E Push Day",
      display_order: 1,
    })
    .select("workout_id")
    .single(),
  "insert workout",
);

const block = await must(
  admin
    .from("blocks")
    .insert({
      owner_user_id: userId,
      block_name: "E2E Main Block",
      block_category: "lifting",
      block_type: "failure",
      display_order: 1,
    })
    .select("block_id")
    .single(),
  "insert block",
);

// --- exercises across muscle groups ---
const exerciseSpecs = [
  { name: "E2E Bench Press", muscle_groups: ["chest", "triceps"], base: 80 },
  { name: "E2E Squat", muscle_groups: ["quads", "glutes"], base: 110 },
  { name: "E2E Row", muscle_groups: ["back"], base: 70 },
];

const exercises = [];
for (const spec of exerciseSpecs) {
  const row = await must(
    admin
      .from("exercises")
      .insert({
        user_id: userId,
        name: spec.name,
        prescribed_min: 5,
        prescribed_max: 8,
        muscle_groups: spec.muscle_groups,
        is_compound: true,
      })
      .select("exercise_id")
      .single(),
    `insert exercise ${spec.name}`,
  );
  exercises.push({ ...spec, exercise_id: row.exercise_id });
}

// --- set_logs: 6 weeks, 2 sessions/week, 3 sets per exercise, progressing ---
const setRows = [];
const now = new Date();
let setCounter = 0;

for (let week = 5; week >= 0; week--) {
  for (const dayOffset of [0, 3]) {
    const d = new Date(now);
    d.setDate(d.getDate() - week * 7 - dayOffset);
    d.setHours(10, 0, 0, 0);

    for (const ex of exercises) {
      const progression = (5 - week) * 2.5; // +2.5kg per week
      for (let set = 1; set <= 3; set++) {
        setCounter += 1;
        setRows.push({
          user_id: userId,
          workout_id: workout.workout_id,
          block_id: block.block_id,
          exercise_id: ex.exercise_id,
          set_index: setCounter, // unique(user, workout, block, set_index)
          weight_kg: ex.base + progression - (set - 1) * 2.5,
          reps: 5 + set, // 6,7,8
          prescribed_min: 5,
          prescribed_max: 8,
          logged_at: new Date(d.getTime() + set * 60000).toISOString(),
        });
      }
    }
  }
}

await must(admin.from("set_logs").insert(setRows), "insert set_logs");

// --- meal_entries: last 30 days, 2-3 meals/day with ranges ---
const mealRows = [];
for (let day = 29; day >= 0; day--) {
  const d = new Date(now);
  d.setDate(d.getDate() - day);
  const dateKey = d.toLocaleDateString("en-CA");
  const meals = day % 3 === 0 ? 2 : 3;

  for (let m = 0; m < meals; m++) {
    const exact = m === 0; // first meal logged exactly, others estimated ranges
    const protein = 35 + m * 10;
    const carbs = 50 + m * 15;
    const fat = 15 + m * 5;
    const proteinMax = exact ? protein : protein + 12;
    const carbsMax = exact ? carbs : carbs + 20;
    const fatMax = exact ? fat : fat + 8;
    mealRows.push({
      user_id: userId,
      date: dateKey,
      meal_type: ["Breakfast", "Lunch", "Dinner"][m] ?? "Meal",
      protein_min_g: protein,
      protein_max_g: proteinMax,
      carbs_min_g: carbs,
      carbs_max_g: carbsMax,
      fat_min_g: fat,
      fat_max_g: fatMax,
      // Calories derived from macros (4/4/9), matching the app's write path.
      cal_min: 4 * (protein + carbs) + 9 * fat,
      cal_max: 4 * (proteinMax + carbsMax) + 9 * fatMax,
      logged_at: new Date(d.setHours(9 + m * 4)).toISOString(),
    });
  }
}

await must(admin.from("meal_entries").insert(mealRows), "insert meal_entries");

// --- nutrition targets ---
await must(
  admin
    .from("nutrition_targets")
    .upsert(
      {
        user_id: userId,
        cal_min: 2400,
        cal_max: 2700,
        protein_min_g: 160,
        protein_max_g: 190,
        carbs_min_g: 250,
        carbs_max_g: 320,
        fat_min_g: 60,
        fat_max_g: 85,
      },
      { onConflict: "user_id" },
    ),
  "upsert nutrition_targets",
);

console.log(
  `seeded: ${setRows.length} sets across ${exercises.length} exercises, ${mealRows.length} meals, targets`,
);
