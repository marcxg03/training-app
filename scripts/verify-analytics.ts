// Fixture tests for src/lib/analytics/projections.ts — run with:
//   pnpm exec tsx scripts/verify-analytics.ts
// Exits non-zero on any failure. No test framework needed.
import {
  buildBestE1rmByDay,
  buildBodyweightTrend,
  buildWeeklyVolumeByGroup,
  weekKeyOf,
  buildBestRepsByDay,
  buildE1rmSpotlights,
  buildNutritionBands,
  dayKeyOf,
  epleyE1rmKg,
  type AnalyticsSetRow,
} from "../src/lib/analytics/projections";
import { addDaysToDayKey, dateStringInTz, dayOfWeekInTz, DEFAULT_APP_TIMEZONE } from "../src/lib/time/appDay";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures += 1;
    console.error(`✗ ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

function approx(name: string, actual: number, expected: number, eps = 1e-9) {
  if (Math.abs(actual - expected) > eps) {
    failures += 1;
    console.error(`✗ ${name}: expected ~${expected}, got ${actual}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

// --- epleyE1rmKg ---
approx("epley: 100kg x 1 = 100 + 100/30", epleyE1rmKg(100, 1), 100 * (1 + 1 / 30));
approx("epley: 90kg x 8 = 114", epleyE1rmKg(90, 8), 90 * (1 + 8 / 30));
approx("epley: zero weight -> 0", epleyE1rmKg(0, 10), 0);
approx("epley: zero reps -> 0", epleyE1rmKg(100, 0), 0);

// Rep cap pinned to LITERALS on both sides of the boundary — a comparison of
// the implementation against itself passes for any cap and catches nothing
// (mutation-tested: cap 12 -> 10 slipped through the old assertion).
approx("rep cap binds at 12: 60x20 = 60*(1+12/30) = 84", epleyE1rmKg(60, 20), 84);
approx("13th rep adds nothing: 60x13 = 84", epleyE1rmKg(60, 13), 84);
approx("11 reps NOT capped", epleyE1rmKg(60, 11), 60 * (1 + 11 / 30));

// --- timezone day bucketing ---
// 02:00 UTC on Jul 2 is 9pm Jul 1 in Chicago (APP_TIMEZONE): an evening set
// must stay on ITS local day, not split onto tomorrow's chart point.
check("dayKeyOf: evening Chicago set stays on its local day",
  dayKeyOf("2026-07-02T02:00:00Z", DEFAULT_APP_TIMEZONE),
  "2026-07-01");
check(
  "e1rm by day: one Chicago evening session = ONE chart point",
  buildBestE1rmByDay([
    { logged_at: "2026-07-01T23:50:00Z", weight_kg: 185, reps: 5 },
    { logged_at: "2026-07-02T00:10:00Z", weight_kg: 205, reps: 3 },
  ], DEFAULT_APP_TIMEZONE).map((p) => p.dayKey),
  ["2026-07-01"],
);

// --- buildBestE1rmByDay ---
// Heaviest set of the day (100x1 -> 103.3) must LOSE to the better-e1RM set
// (90x8 -> 114) on the same day.
const day1 = [
  { logged_at: "2026-07-01T10:00:00Z", weight_kg: 100, reps: 1 },
  { logged_at: "2026-07-01T10:05:00Z", weight_kg: 90, reps: 8 },
];
check(
  "e1rm by day: best e1RM wins over heaviest weight",
  buildBestE1rmByDay(day1, DEFAULT_APP_TIMEZONE).map((p) => ({ dayKey: p.dayKey, value: p.value })),
  [{ dayKey: "2026-07-01", value: 90 * (1 + 8 / 30) }],
);

// Multi-day: chronological output, null/zero weights skipped.
const multi = [
  { logged_at: "2026-07-03T10:00:00Z", weight_kg: 80, reps: 5 },
  { logged_at: "2026-07-01T10:00:00Z", weight_kg: 100, reps: 3 },
  { logged_at: "2026-07-02T10:00:00Z", weight_kg: null, reps: 10 },
  { logged_at: "2026-07-02T11:00:00Z", weight_kg: 0, reps: 10 },
];
check(
  "e1rm by day: chronological, skips null/zero weight days entirely",
  buildBestE1rmByDay(multi, DEFAULT_APP_TIMEZONE).map((p) => p.dayKey),
  ["2026-07-01", "2026-07-03"],
);

// --- buildBestRepsByDay ---
const bw = [
  { logged_at: "2026-07-01T10:00:00Z", weight_kg: null, reps: 12 },
  { logged_at: "2026-07-01T10:05:00Z", weight_kg: null, reps: 15 },
  { logged_at: "2026-07-02T10:00:00Z", weight_kg: null, reps: 14 },
];
check(
  "reps by day: max reps per day, chronological",
  buildBestRepsByDay(bw, DEFAULT_APP_TIMEZONE).map((p) => ({ dayKey: p.dayKey, value: p.value })),
  [
    { dayKey: "2026-07-01", value: 15 },
    { dayKey: "2026-07-02", value: 14 },
  ],
);

// --- buildE1rmSpotlights: ranking, cutoff, limit, exclusions ---
function makeRows(
  exerciseId: string,
  name: string,
  isBodyweight: boolean,
  setDays: string[], // dayKeys (noon UTC = same local day in Chicago)
): AnalyticsSetRow[] {
  return setDays.map((day, index) => ({
    exercise_id: exerciseId,
    weight_kg: isBodyweight ? null : 100,
    reps: 5,
    logged_at: `${day}T17:0${index % 10}:00Z`, // noon Chicago
    exercises: { name, is_bodyweight: isBodyweight, muscle_groups: ["test"] },
  }));
}

const CUTOFF = "2026-07-01"; // rank window start
const WINDOW = "2026-06-01"; // fetch window start
const inWin = (n: number) => Array.from({ length: n }, (_, i) => `2026-07-${String(2 + (i % 20)).padStart(2, "0")}`);

const spotlightRows: AnalyticsSetRow[] = [
  ...makeRows("ex-a", "Alpha", false, inWin(9)),
  ...makeRows("ex-b", "Bravo", false, inWin(7)),
  ...makeRows("ex-c", "Charlie", false, inWin(7)),
  ...makeRows("ex-d", "Delta", false, inWin(3)),
  ...makeRows("ex-e", "Echo", false, inWin(1)),
  // bodyweight with tons of sets — must be excluded entirely
  ...makeRows("ex-bw", "Pullup", true, inWin(50)),
  // active before the rank cutoff only — has points but rank 0
  ...makeRows("ex-old", "Oldie", false, ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15"]),
];

check(
  "spotlights: top-4 by recent set count, desc, name tiebreak, bodyweight excluded",
  buildE1rmSpotlights(spotlightRows, {
    rankCutoffKey: CUTOFF,
    windowStartKey: WINDOW,
    limit: 4,
    timeZone: DEFAULT_APP_TIMEZONE,
  }).map((s) => s.exercise_id),
  ["ex-a", "ex-b", "ex-c", "ex-d"], // Bravo before Charlie by name at 7=7
);

// Zero-chartable-points exercises must not burn a spotlight slot: an
// exercise whose sets all have reps=0 (no e1RM points) ranks 0 points and is
// dropped BEFORE the limit, letting the 4th real exercise in.
const zeroPointRows: AnalyticsSetRow[] = [
  ...makeRows("ex-a", "Alpha", false, inWin(9)),
  ...makeRows("ex-b", "Bravo", false, inWin(8)),
  ...makeRows("ex-c", "Charlie", false, inWin(7)),
  ...inWin(20).map((day) => ({
    exercise_id: "ex-junk",
    weight_kg: 100,
    reps: 0, // e1RM = 0 -> no points
    logged_at: `${day}T17:00:00Z`,
    exercises: { name: "Junk", is_bodyweight: false, muscle_groups: [] },
  })),
  ...makeRows("ex-d", "Delta", false, inWin(2)),
];
check(
  "spotlights: pointless exercises don't burn a slot",
  buildE1rmSpotlights(zeroPointRows, {
    rankCutoffKey: CUTOFF,
    windowStartKey: WINDOW,
    limit: 4,
    timeZone: DEFAULT_APP_TIMEZONE,
  }).map((s) => s.exercise_id),
  ["ex-a", "ex-b", "ex-c", "ex-d"],
);

// Window trim: sets before windowStartKey are excluded from series AND rank.
check(
  "spotlights: rows before windowStartKey are ignored",
  buildE1rmSpotlights(
    makeRows("ex-a", "Alpha", false, ["2026-05-20", "2026-07-02"]),
    { rankCutoffKey: CUTOFF, windowStartKey: WINDOW, limit: 4, timeZone: DEFAULT_APP_TIMEZONE },
  )[0].points.map((p) => p.dayKey),
  ["2026-07-02"],
);


// --- buildWeeklyVolumeByGroup ---

// Week keys: Monday anchoring, including across month boundaries.
check("weekKeyOf: Wednesday -> its Monday", weekKeyOf("2026-07-01"), "2026-06-29");
check("weekKeyOf: Monday -> itself", weekKeyOf("2026-06-29"), "2026-06-29");
check("weekKeyOf: Sunday -> preceding Monday", weekKeyOf("2026-07-05"), "2026-06-29");

const NOW = new Date("2026-07-28T18:00:00Z"); // Tue, week of Mon 2026-07-27

const volumeRows: AnalyticsSetRow[] = [
  // 2 chest+triceps sets this week (double-count rule)
  {
    exercise_id: "bench", weight_kg: 100, reps: 5,
    logged_at: "2026-07-27T17:00:00Z",
    exercises: { name: "Bench", is_bodyweight: false, muscle_groups: ["chest", "triceps"] },
  },
  {
    exercise_id: "bench", weight_kg: 100, reps: 5,
    logged_at: "2026-07-28T17:00:00Z",
    exercises: { name: "Bench", is_bodyweight: false, muscle_groups: ["chest", "triceps"] },
  },
  // bodyweight set: counts as a back set, adds zero tonnage
  {
    exercise_id: "pullup", weight_kg: null, reps: 10,
    logged_at: "2026-07-27T17:30:00Z",
    exercises: { name: "Pullup", is_bodyweight: true, muscle_groups: ["back"] },
  },
  // 3 weeks ago, chest — creates a gap that must be zero-filled, not bridged
  {
    exercise_id: "bench", weight_kg: 90, reps: 10,
    logged_at: "2026-07-07T17:00:00Z",
    exercises: { name: "Bench", is_bodyweight: false, muscle_groups: ["chest", "triceps"] },
  },
];

const volume = buildWeeklyVolumeByGroup(volumeRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW });
const chest = volume.find((g) => g.muscle_group === "chest");
const back = volume.find((g) => g.muscle_group === "back");

check("volume: chest and triceps both counted (double-count rule)",
  volume.filter((g) => ["chest", "triceps"].includes(g.muscle_group)).length, 2);
check("volume: 8 zero-filled week buckets", chest?.weeks.length, 8);
check("volume: chest current week = 2 sets", chest?.currentWeekSets, 2);
check("volume: gap weeks are explicit zeros",
  chest?.weeks.map((w) => w.sets), [0, 0, 0, 0, 1, 0, 0, 2]);
check("volume: bodyweight set counts for sets", back?.currentWeekSets, 1);
check("volume: bodyweight adds zero tonnage", back?.totalTonnageKg, 0);
approx("volume: chest tonnage = 100*5*2 + 90*10", chest?.totalTonnageKg ?? 0, 1900);
check("volume: sorted by total sets desc",
  volume[0].muscle_group === "chest" || volume[0].muscle_group === "triceps", true);


// --- volume: window guards, boundary NOW, full sort order (mutant killers) ---

// Out-of-window rows must not create phantom groups (kills dropped-guard
// mutants: past rows would materialize as all-zero rows, future rows too).
const guardRows: AnalyticsSetRow[] = [
  ...volumeRows,
  {
    exercise_id: "squat", weight_kg: 120, reps: 5,
    logged_at: "2026-05-15T17:00:00Z", // long before the 8-week window
    exercises: { name: "Squat", is_bodyweight: false, muscle_groups: ["quads"] },
  },
  {
    exercise_id: "calf", weight_kg: 60, reps: 12,
    logged_at: "2026-08-05T17:00:00Z", // future beyond current week
    exercises: { name: "Calf Raise", is_bodyweight: false, muscle_groups: ["calves"] },
  },
];
check(
  "volume: out-of-window rows create no groups",
  buildWeeklyVolumeByGroup(guardRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW }).some((g) =>
    ["quads", "calves"].includes(g.muscle_group),
  ),
  false,
);

// Sunday-night boundary: Sun 10pm Chicago is already Monday UTC. The current
// week must still anchor to the CHICAGO Monday (kills the UTC-weekKey mutant).
const NOW_SUN = new Date("2026-07-27T03:00:00Z"); // Sun Jul 26, 10pm Chicago
const sundayRows: AnalyticsSetRow[] = [
  {
    exercise_id: "bench", weight_kg: 100, reps: 5,
    logged_at: "2026-07-27T02:00:00Z", // Sun Jul 26, 9pm Chicago
    exercises: { name: "Bench", is_bodyweight: false, muscle_groups: ["chest"] },
  },
];
const sunday = buildWeeklyVolumeByGroup(sundayRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW_SUN });
check("volume: Sunday-night NOW anchors to Chicago week",
  sunday[0].weeks[7].weekKey, "2026-07-20");
check("volume: Sunday-night set lands in current week",
  sunday[0].currentWeekSets, 1);

// Full order pinned with an asymmetric fixture — insertion order differs from
// sorted order, so a deleted/flipped sort or tiebreak fails (kills 3 mutants).
const orderRows: AnalyticsSetRow[] = [
  ...volumeRows,
  {
    exercise_id: "pushdown", weight_kg: 30, reps: 12,
    logged_at: "2026-07-28T18:30:00Z",
    exercises: { name: "Pushdown", is_bodyweight: false, muscle_groups: ["triceps"] },
  },
  {
    exercise_id: "curl", weight_kg: 20, reps: 12,
    logged_at: "2026-07-28T18:40:00Z",
    exercises: { name: "Curl", is_bodyweight: false, muscle_groups: ["biceps"] },
  },
];
check(
  "volume: full order — sets desc, name-asc tiebreak",
  buildWeeklyVolumeByGroup(orderRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW }).map((g) => g.muscle_group),
  ["triceps", "chest", "back", "biceps"],
);

// Duplicate/case-variant tags must not double-count one set.
const dupRows: AnalyticsSetRow[] = [
  {
    exercise_id: "bench", weight_kg: 100, reps: 5,
    logged_at: "2026-07-28T17:00:00Z",
    exercises: { name: "Bench", is_bodyweight: false, muscle_groups: ["chest", "Chest"] },
  },
];
const dedup = buildWeeklyVolumeByGroup(dupRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW });
check("volume: duplicate tags dedupe to one group", dedup.length, 1);
check("volume: duplicate tags count the set once", dedup[0].currentWeekSets, 1);
approx("volume: duplicate tags count tonnage once", dedup[0].totalTonnageKg, 500);

// Untagged exercises bucket under "other" rather than vanishing.
const otherRows: AnalyticsSetRow[] = [
  {
    exercise_id: "sled", weight_kg: 80, reps: 10,
    logged_at: "2026-07-28T17:00:00Z",
    exercises: { name: "Sled Push", is_bodyweight: false, muscle_groups: [] },
  },
];
check("volume: untagged sets bucket under other",
  buildWeeklyVolumeByGroup(otherRows, { weeks: 8, timeZone: DEFAULT_APP_TIMEZONE, now: NOW })[0].muscle_group,
  "other");


// --- buildNutritionBands ---
const mealFixtures = [
  // day 1: exact meal + estimated meal -> summed mins/maxes
  { date: "2026-07-01", cal_min: 500, cal_max: 500, protein_min_g: 40, protein_max_g: 40 },
  { date: "2026-07-01", cal_min: 600, cal_max: 800, protein_min_g: 30, protein_max_g: 45 },
  // day 3 (day 2 has NO meals -> omitted, not zero-filled)
  { date: "2026-07-03", cal_min: 2000, cal_max: 2000, protein_min_g: 150, protein_max_g: 150 },
];
const bands = buildNutritionBands(mealFixtures);
check("nutrition: per-day range sums",
  bands.calories.map((p) => ({ dayKey: p.dayKey, min: p.min, max: p.max })),
  [
    { dayKey: "2026-07-01", min: 1100, max: 1300 },
    { dayKey: "2026-07-03", min: 2000, max: 2000 },
  ]);
check("nutrition: unlogged days omitted (no fake fasting zeros)",
  bands.protein.map((p) => p.dayKey), ["2026-07-01", "2026-07-03"]);
// midpoints: day1 cal (1100+1300)/2=1200, day3 2000 -> avg 1600
check("nutrition: avg calories midpoint", bands.avgCaloriesMid, 1600);
// day1 protein (70+85)/2=77.5, day3 150 -> avg 113.75 -> 114
check("nutrition: avg protein midpoint rounds", bands.avgProteinMid, 114);
check("nutrition: empty input -> null averages, empty series",
  JSON.stringify(buildNutritionBands([])),
  JSON.stringify({ calories: [], protein: [], avgCaloriesMid: null, avgProteinMid: null }));


// Mutant killers (Slice 3 roast): out-of-order input pins the sort; protein
// min/max pinned per day (a min/max accumulation swap survived before);
// non-integer average pins rounding; Object.is pins null-not-NaN (check()'s
// JSON.stringify masks NaN as null).
const ob = buildNutritionBands([
  { date: "2026-07-05", cal_min: 700, cal_max: 903, protein_min_g: 20, protein_max_g: 60 },
  { date: "2026-07-02", cal_min: 500, cal_max: 500, protein_min_g: 10, protein_max_g: 30 },
]);
check("nutrition: out-of-order input sorts; protein min/max pinned per day",
  ob.protein.map((p) => ({ dayKey: p.dayKey, min: p.min, max: p.max })),
  [{ dayKey: "2026-07-02", min: 10, max: 30 }, { dayKey: "2026-07-05", min: 20, max: 60 }]);
check("nutrition: calorie avg rounds (650.75 -> 651)", ob.avgCaloriesMid, 651);
const emptyBands = buildNutritionBands([]);
check("nutrition: empty averages are strictly null, not NaN",
  Object.is(emptyBands.avgCaloriesMid, null) && Object.is(emptyBands.avgProteinMid, null), true);

// Partial-day rule: today's point stays on the chart but not in the average.
const partial = buildNutritionBands(
  [
    { date: "2026-07-27", cal_min: 2000, cal_max: 2000, protein_min_g: 150, protein_max_g: 150 },
    { date: "2026-07-28", cal_min: 500, cal_max: 500, protein_min_g: 40, protein_max_g: 40 },
  ],
  { partialDayKey: "2026-07-28" },
);
check("nutrition: partial day keeps its band point",
  partial.calories.map((p) => p.dayKey), ["2026-07-27", "2026-07-28"]);
check("nutrition: partial day excluded from average", partial.avgCaloriesMid, 2000);
check("nutrition: ONLY a partial day -> null averages",
  Object.is(
    buildNutritionBands(
      [{ date: "2026-07-28", cal_min: 500, cal_max: 500, protein_min_g: 40, protein_max_g: 40 }],
      { partialDayKey: "2026-07-28" },
    ).avgCaloriesMid,
    null,
  ),
  true);

// 30-day window arithmetic pinned (month-boundary crossing): the trends page
// computes windowStart = addDaysToDayKey(today, -(30 - 1)).
check("nutrition window: 30 days inclusive (Jun 29 .. Jul 28)",
  addDaysToDayKey("2026-07-28", -29), "2026-06-29");
check("addDaysToDayKey: year boundary", addDaysToDayKey("2026-01-01", -1), "2025-12-31");

// --- app day clock (the 7pm-Central rollover bug, pinned) ---
// 2026-07-29T01:00Z is Tue Jul 28, 8pm in Chicago. A UTC server must still
// answer "Tuesday, Jul 28".
const eveningUtc = new Date("2026-07-29T01:00:00Z");
check("app clock: 8pm Central is still today", dateStringInTz("America/Chicago", eveningUtc), "2026-07-28");
check("app clock: 8pm Central is still Tuesday", dayOfWeekInTz("America/Chicago", eveningUtc), "tue");
check("app clock: UTC tz keeps UTC day", dateStringInTz("UTC", eveningUtc), "2026-07-29");

// --- buildBodyweightTrend ---
const bwTrend = buildBodyweightTrend([
  { log_date: "2026-07-03", weight_kg: 82.5 },
  { log_date: "2026-07-01", weight_kg: 83.1 },
  { log_date: "2026-07-02", weight_kg: 0 }, // invalid, skipped
  { log_date: "2026-07-04", weight_kg: NaN }, // invalid, skipped
]);
check("bodyweight: chronological, invalid rows skipped",
  bwTrend.map((p) => ({ dayKey: p.dayKey, value: p.value })),
  [
    { dayKey: "2026-07-01", value: 83.1 },
    { dayKey: "2026-07-03", value: 82.5 },
  ]);
check("bodyweight: empty input -> empty series",
  buildBodyweightTrend([]).length, 0);

// --- buildMealDaySummaries (meal history list) ---
import { buildMealDaySummaries } from "../src/lib/nutrition/summary";
const daySummaries = buildMealDaySummaries(
  [
    { meal_id: "a", meal_type: "Breakfast", date: "2026-07-27", cal_min: 500, cal_max: 500, protein_min_g: 0, protein_max_g: 0, carbs_min_g: 0, carbs_max_g: 0, fat_min_g: 0, fat_max_g: 0, note: null, logged_at: "2026-07-27T14:00:00Z" },
    { meal_id: "b", meal_type: "Dinner", date: "2026-07-27", cal_min: 900, cal_max: 1100, protein_min_g: 0, protein_max_g: 0, carbs_min_g: 0, carbs_max_g: 0, fat_min_g: 0, fat_max_g: 0, note: null, logged_at: "2026-07-27T23:00:00Z" },
    { meal_id: "c", meal_type: "Lunch", date: "2026-07-28", cal_min: 2500, cal_max: 2600, protein_min_g: 0, protein_max_g: 0, carbs_min_g: 0, carbs_max_g: 0, fat_min_g: 0, fat_max_g: 0, note: null, logged_at: "2026-07-28T18:00:00Z" },
  ],
  { cal_min: 2400, cal_max: 2700, protein_min_g: 160, protein_max_g: 190, carbs_min_g: 250, carbs_max_g: 320, fat_min_g: 60, fat_max_g: 85 },
);
check("meal days: newest first, counts and cal sums",
  daySummaries.map((d) => ({ date: d.date, n: d.mealCount, min: d.calMin, max: d.calMax })),
  [
    { date: "2026-07-28", n: 1, min: 2500, max: 2600 },
    { date: "2026-07-27", n: 2, min: 1400, max: 1600 },
  ]);
check("meal days: status vs target zone",
  daySummaries.map((d) => d.status), ["in", "under"]);
check("meal days: null targets -> null status",
  buildMealDaySummaries(
    [{ meal_id: "a", meal_type: "M", date: "2026-07-27", cal_min: 1, cal_max: 1, protein_min_g: 0, protein_max_g: 0, carbs_min_g: 0, carbs_max_g: 0, fat_min_g: 0, fat_max_g: 0, note: null, logged_at: "x" }],
    null,
  )[0].status,
  null);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll analytics fixture tests passed.");
