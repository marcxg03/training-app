// Fixture tests for the admin analytics shaping (T3-E). Run with:
//   pnpm exec tsx scripts/verify-admin-dashboard.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHY EVERY CASE PINS "TODAY": each function takes the reference day as an
// argument precisely so these assertions are identical on every machine and at
// every hour. A dashboard whose streak depends on when the test runs is a
// dashboard nobody trusts, and a test that passes at 2pm and fails at 11pm is
// worse than no test.
//
// The reference day below is a WEDNESDAY (2026-09-23), chosen so the
// current-week logic is exercised mid-week — the case where "this week is
// still in progress" actually matters.
//
// WRITTEN TO FAIL FIRST: before src/lib/analytics/admin-dashboard.ts exists
// this import throws.
import {
  addDays,
  adherencePerWeek,
  daysBetween,
  daysSinceLastSession,
  muscleGroupCoverage,
  nutritionLoggingRate,
  prsPerWeek,
  recentWeeks,
  sessionsPerWeek,
  sumWeeks,
  volumePerWeek,
  weekLabel,
  weekStart,
  weekStreak,
} from "../src/lib/analytics/admin-dashboard";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures += 1;
    console.error(
      `✗ ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`,
    );
  } else {
    console.log(`✓ ${name}`);
  }
}

const TODAY = "2026-09-23"; // a Wednesday
const THIS_WEEK = "2026-09-21"; // the Monday of it

// --- calendar helpers ---------------------------------------------------
check("weekStart of a Wednesday is its Monday", weekStart(TODAY), THIS_WEEK);
check("weekStart of a Monday is itself", weekStart("2026-09-21"), "2026-09-21");
// The off-by-one that a Sunday-start week would introduce: Sunday belongs to
// the week that STARTED, not the one about to.
check("weekStart of a Sunday is the PREVIOUS Monday", weekStart("2026-09-27"), "2026-09-21"); // prettier-ignore
check("weekStart of a Saturday is the same Monday", weekStart("2026-09-26"), "2026-09-21"); // prettier-ignore

check("addDays crosses a month boundary", addDays("2026-09-30", 1), "2026-10-01"); // prettier-ignore
check("addDays goes backwards", addDays("2026-10-01", -1), "2026-09-30");
check("addDays crosses a year boundary", addDays("2026-12-31", 1), "2027-01-01");
// A leap year is the classic place naive date maths breaks.
check("addDays handles Feb 29 in a leap year", addDays("2028-02-28", 1), "2028-02-29"); // prettier-ignore
check("addDays handles a non-leap February", addDays("2026-02-28", 1), "2026-03-01"); // prettier-ignore

check("daysBetween counts forward", daysBetween("2026-09-20", "2026-09-23"), 3);
check("daysBetween is zero for the same day", daysBetween(TODAY, TODAY), 0);
check("daysBetween spans a month", daysBetween("2026-08-31", "2026-09-01"), 1);

check("recentWeeks returns the window, oldest first", recentWeeks(TODAY, 3), ["2026-09-07", "2026-09-14", "2026-09-21"]); // prettier-ignore
check("recentWeeks ends with this week", recentWeeks(TODAY, 12).at(-1), THIS_WEEK); // prettier-ignore
check("recentWeeks length matches the request", recentWeeks(TODAY, 12).length, 12); // prettier-ignore
check("weekLabel is short and human", weekLabel("2026-09-07"), "Sep 7");

// --- sessions per week --------------------------------------------------
const SESSIONS = [
  { date: "2026-09-21" }, // this week
  { date: "2026-09-23" }, // this week
  { date: "2026-09-15" }, // last week
  { date: "2026-09-08" }, // two weeks ago
  { date: "2026-06-01" }, // far outside the window
];

const perWeek = sessionsPerWeek(SESSIONS, TODAY, 3);
check("sessions bucket into their week", perWeek.map((p) => p.value), [1, 1, 2]); // prettier-ignore
check("every week in the window appears, even empty ones", sessionsPerWeek([], TODAY, 4).map((p) => p.value), [0, 0, 0, 0]); // prettier-ignore
check("points carry their week start", perWeek.at(-1)?.weekStart, THIS_WEEK);
check("sumWeeks totals the series", sumWeeks(perWeek), 4);
// The out-of-window session must not leak into the first bucket — a classic
// bug where "everything older" piles onto the left-most bar.
check("old sessions do not pile into the first bucket", perWeek[0].value, 1);

// --- volume -------------------------------------------------------------
const SETS = [
  { date: "2026-09-21", volumeKg: 100.4, muscleGroups: ["chest"] },
  { date: "2026-09-22", volumeKg: 99.6, muscleGroups: ["chest", "triceps"] },
  { date: "2026-09-15", volumeKg: 50, muscleGroups: ["back"] },
];
check("volume sums per week and rounds once", volumePerWeek(SETS, TODAY, 2).map((p) => p.value), [50, 200]); // prettier-ignore

// --- PRs ----------------------------------------------------------------
check("PRs bucket per week", prsPerWeek([{ date: "2026-09-22" }, { date: "2026-09-23" }], TODAY, 2).map((p) => p.value), [0, 2]); // prettier-ignore

// --- adherence ----------------------------------------------------------
const adherence = adherencePerWeek(SESSIONS, 4, TODAY, 3);
check("adherence is a percentage of prescribed", adherence.map((p) => p.value), [25, 25, 50]); // prettier-ignore
check("adherence keeps the raw counts", adherence.at(-1), {
  weekStart: THIS_WEEK,
  label: "Sep 21",
  value: 50,
  completed: 2,
  prescribed: 4,
  extra: 0,
});
// Training MORE than prescribed must not blow past 100 and squash every other
// bar — the overflow is reported separately.
const over = adherencePerWeek([{ date: TODAY }, { date: TODAY }, { date: TODAY }], 2, TODAY, 1); // prettier-ignore
check("adherence caps at 100", over[0].value, 100);
check("the overflow is reported, not drawn", over[0].extra, 1);
// A plan with no prescribed sessions must not divide by zero.
check("zero prescribed does not produce NaN or Infinity", adherencePerWeek(SESSIONS, 0, TODAY, 1)[0].value, 0); // prettier-ignore

// --- streak -------------------------------------------------------------
// The rule that matters: an EMPTY current week does not break the streak,
// because it is still in progress. Counting it would reset to 0 every Monday.
check(
  "an empty current week does not break the streak",
  weekStreak([{ date: "2026-09-15" }, { date: "2026-09-08" }], "2026-09-21"),
  2,
);
check(
  "a session this week counts immediately",
  weekStreak([{ date: TODAY }, { date: "2026-09-15" }], TODAY),
  2,
);
check("a gap ends the streak", weekStreak([{ date: TODAY }, { date: "2026-09-01" }], TODAY), 1); // prettier-ignore
check("no sessions means no streak", weekStreak([], TODAY), 0);
// Two sessions in one week are one week of streak, not two.
check("a week counts once however many sessions", weekStreak([{ date: "2026-09-21" }, { date: "2026-09-23" }], TODAY), 1); // prettier-ignore

// --- dormancy -----------------------------------------------------------
check("days since the most recent session", daysSinceLastSession(SESSIONS, TODAY), 0); // prettier-ignore
check("picks the LATEST session, not the last in the array", daysSinceLastSession([{ date: "2026-09-01" }, { date: "2026-09-20" }, { date: "2026-09-10" }], TODAY), 3); // prettier-ignore
check("null when there has never been a session", daysSinceLastSession([], TODAY), null); // prettier-ignore
// A future-dated row must not produce a negative "days since".
check("a future session clamps to 0", daysSinceLastSession([{ date: "2026-10-01" }], TODAY), 0); // prettier-ignore

// --- nutrition ----------------------------------------------------------
check("logging rate counts distinct days in the window", nutritionLoggingRate([{ date: TODAY }, { date: TODAY }, { date: "2026-09-22" }], TODAY, 10), { days: 2, window: 10, pct: 20 }); // prettier-ignore
check("meals outside the window are ignored", nutritionLoggingRate([{ date: "2026-01-01" }], TODAY, 10), { days: 0, window: 10, pct: 0 }); // prettier-ignore

// --- muscle coverage ----------------------------------------------------
const coverage = muscleGroupCoverage(SETS, TODAY, 28);
check("a set counts once per muscle group it names", coverage, [
  { label: "chest", value: 2 },
  { label: "back", value: 1 },
  { label: "triceps", value: 1 },
]);
check("coverage is ranked, ties broken alphabetically", coverage.map((c) => c.label), ["chest", "back", "triceps"]); // prettier-ignore
check("sets outside the window are excluded", muscleGroupCoverage(SETS, TODAY, 3).map((c) => c.label), ["chest", "triceps"]); // prettier-ignore
check("no sets means an empty list, not a crash", muscleGroupCoverage([], TODAY), []); // prettier-ignore

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll admin-dashboard checks passed.");
