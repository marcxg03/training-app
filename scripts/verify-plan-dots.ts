// Fixture tests for the Plan week's session-type → dot-color mapping (Slice S4, D19).
// Run with:
//   pnpm exec tsx scripts/verify-plan-dots.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// D19: the week's session-type dot colors — accent = lift, warning = sport/
// basketball, cardio-teal = HYROX/conditioning, border/grey = rest. The real
// session_type_enum is lifting | cardio | recovery (+ a rest-day flag); it has
// no dedicated "sport" value, so sportsball currently rides the same lane as its
// stored type. The "sport" token is reserved for a future schema distinction.
//
// WRITTEN TO FAIL FIRST: before src/lib/plan/plan-dots.ts exists this import
// throws (module not found) — red. Once the module matches the contract below,
// every case passes — green.
import {
  PLAN_DOT_COLOR,
  dayDotKind,
  sessionTypeToDotKind,
  type PlanDotKind,
} from "../src/lib/plan/plan-dots";

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

// --- session type → dot kind -------------------------------------------
check("lifting → lift", sessionTypeToDotKind("lifting"), "lift");
check("cardio → cond", sessionTypeToDotKind("cardio"), "cond");
check("recovery → rest", sessionTypeToDotKind("recovery"), "rest");

// --- every dot kind has a token color ----------------------------------
const kinds: PlanDotKind[] = ["lift", "sport", "cond", "rest"];
for (const kind of kinds) {
  check(
    `${kind} maps to a bg-* token`,
    typeof PLAN_DOT_COLOR[kind] === "string" &&
      PLAN_DOT_COLOR[kind].startsWith("bg-"),
    true,
  );
}
check("lift token is accent", PLAN_DOT_COLOR.lift, "bg-accent");
check("sport token is warning", PLAN_DOT_COLOR.sport, "bg-warning");
check("cond token is cardio", PLAN_DOT_COLOR.cond, "bg-cardio");
check("rest token is border", PLAN_DOT_COLOR.rest, "bg-border");

// --- day → representative dot kind -------------------------------------
check(
  "rest day (flag, no sessions) → rest",
  dayDotKind({ isRestDay: true, sessionTypes: [] }),
  "rest",
);
check(
  "empty day (no rest flag, no sessions) → rest",
  dayDotKind({ isRestDay: false, sessionTypes: [] }),
  "rest",
);
check(
  "lifting present dominates cardio → lift",
  dayDotKind({ isRestDay: false, sessionTypes: ["cardio", "lifting"] }),
  "lift",
);
check(
  "cardio without lifting → cond",
  dayDotKind({ isRestDay: false, sessionTypes: ["cardio"] }),
  "cond",
);
check(
  "recovery-only day → rest",
  dayDotKind({ isRestDay: false, sessionTypes: ["recovery"] }),
  "rest",
);
check(
  "cardio beats recovery when no lifting → cond",
  dayDotKind({ isRestDay: false, sessionTypes: ["recovery", "cardio"] }),
  "cond",
);
check(
  "rest flag wins even if a stray session exists → rest",
  dayDotKind({ isRestDay: true, sessionTypes: ["lifting"] }),
  "rest",
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll plan-dots checks passed.");
