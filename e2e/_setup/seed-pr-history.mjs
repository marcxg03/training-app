// Seeds pr_history (and the workout_completions rows the PR timeline joins
// through) for the e2e user, on top of whatever seed-analytics-data.mjs laid
// down. Split out rather than folded in because seed-analytics-data is a
// CHART fixture — it deliberately creates no completions so the set_logs
// unique index stays out of the way — while the PR surfaces need both.
//
// Why completions are required: getPRTimeline() drops any PR whose achieved_at
// does not fall inside a workout_completions window for that set's workout
// (src/lib/history/queries.ts findMatchingCompletion). A PR row alone is
// invisible.
//
// Run: node --env-file=.env.local e2e/_setup/seed-pr-history.mjs <userId>
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!URL || !SERVICE || !userId) {
  console.error(
    "Usage: node --env-file=.env.local seed-pr-history.mjs <userId>",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// SAFETY GATE — identical to seed-analytics-data.mjs. This script DELETEs with
// the service role; it must never be able to touch a real account.
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

// --- start clean (pr_history is append-only in the app, not in a fixture) ---
await must(
  admin.from("pr_history").delete().eq("user_id", userId),
  "wipe pr_history",
);
await must(
  admin.from("workout_completions").delete().eq("user_id", userId),
  "wipe workout_completions",
);

// --- the set_logs seed-analytics-data laid down, oldest first ---
const setLogs = await must(
  admin
    .from("set_logs")
    .select(
      "set_log_id, exercise_id, workout_id, block_id, weight_kg, reps, logged_at",
    )
    .eq("user_id", userId)
    .order("logged_at", { ascending: true }),
  "read set_logs",
);

if (!setLogs || setLogs.length === 0) {
  console.error(
    "No set_logs for this user — run seed-analytics-data.mjs first.",
  );
  process.exit(1);
}

const exercises = await must(
  admin.from("exercises").select("exercise_id, name").eq("user_id", userId),
  "read exercises",
);
const nameById = Object.fromEntries(
  exercises.map((row) => [row.exercise_id, row.name]),
);

// --- one completion per (workout, session day), spanning that day ---
const dayKeyOf = (iso) => iso.slice(0, 10);
const sessions = new Map();

for (const row of setLogs) {
  const key = `${row.workout_id}|${dayKeyOf(row.logged_at)}`;
  const entry = sessions.get(key);

  if (entry) {
    entry.blockIds.add(row.block_id);
    entry.last = row.logged_at;
  } else {
    sessions.set(key, {
      workout_id: row.workout_id,
      first: row.logged_at,
      last: row.logged_at,
      blockIds: new Set([row.block_id]),
    });
  }
}

const completionRows = [...sessions.values()].map((session) => ({
  user_id: userId,
  workout_id: session.workout_id,
  // Widen the window by an hour each side so every PR instant lands inside it
  // even after rounding.
  started_at: new Date(
    new Date(session.first).getTime() - 3600_000,
  ).toISOString(),
  completed_at: new Date(
    new Date(session.last).getTime() + 3600_000,
  ).toISOString(),
  was_ended_early: false,
  completed_block_ids: [...session.blockIds],
}));

await must(
  admin.from("workout_completions").insert(completionRows),
  "insert workout_completions",
);

// --- PRs: walk each exercise's sets chronologically and record a real PR
//     every time the load or the in-range rep count beats the running best.
//     Same shape the logger writes at runtime (weight PR | in_range_rep PR),
//     one row per (set_log_id, pr_type) — the unique index in migration 009.
const prRows = [];
const bestWeight = new Map();
const bestReps = new Map();

for (const row of setLogs) {
  const weight = Number(row.weight_kg ?? 0);
  const reps = Number(row.reps ?? 0);

  if (weight > (bestWeight.get(row.exercise_id) ?? 0)) {
    bestWeight.set(row.exercise_id, weight);
    prRows.push({
      user_id: userId,
      exercise_id: row.exercise_id,
      set_log_id: row.set_log_id,
      pr_type: "weight",
      weight_kg: weight,
      reps,
      achieved_at: row.logged_at,
    });
  }

  if (reps > (bestReps.get(row.exercise_id) ?? 0)) {
    bestReps.set(row.exercise_id, reps);
    prRows.push({
      user_id: userId,
      exercise_id: row.exercise_id,
      set_log_id: row.set_log_id,
      pr_type: "in_range_rep",
      weight_kg: weight,
      reps,
      achieved_at: row.logged_at,
    });
  }
}

await must(admin.from("pr_history").insert(prRows), "insert pr_history");

// Report which exercise carries the most PRs — that is the one the Progress
// spotlight features, so a drive can navigate straight to it.
const counts = new Map();
for (const pr of prRows) {
  counts.set(pr.exercise_id, (counts.get(pr.exercise_id) ?? 0) + 1);
}
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const [topExerciseId, topCount] = ranked[0];

console.log(
  JSON.stringify({
    completions: completionRows.length,
    prs: prRows.length,
    weightPRs: prRows.filter((p) => p.pr_type === "weight").length,
    repPRs: prRows.filter((p) => p.pr_type === "in_range_rep").length,
    topExerciseId,
    topExerciseName: nameById[topExerciseId],
    topExercisePRs: topCount,
  }),
);
