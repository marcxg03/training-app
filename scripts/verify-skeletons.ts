// Fixture tests for the route-transition skeletons (T3-D). Run with:
//   pnpm exec tsx scripts/verify-skeletons.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHY THESE ARE FIXTURES AND NOT BROWSER ASSERTIONS: whether a skeleton is
// SEEN depends on Next's client router cache — a tab you already visited
// renders instantly from cache and shows no loading state at all, which is
// correct behaviour and makes a browser check for "is there a skeleton"
// nondeterministic. So the drive measures the TIMING (dead air gone) and this
// file pins the SHAPE, which is pure render output and always the same.
//
// The shape matters for a real reason: a skeleton whose proportions do not
// match what arrives makes content jump on load — a different kind of jarring
// from the freeze it replaces. Today opens with a tall focal card, so its
// skeleton has to as well.
//
// Gotcha (same as verify-charts.ts): Next's tsconfig uses jsx:preserve, so tsx
// compiles components to classic React.createElement — React must be on
// globalThis.
import * as React from "react";
(globalThis as Record<string, unknown>).React = React;

import { renderToStaticMarkup } from "react-dom/server";

import TodayLoading from "../src/app/(app)/today/loading";
import PlanLoading from "../src/app/(app)/plan/loading";
import NutritionLoading from "../src/app/(app)/nutrition/loading";
import ProgressLoading from "../src/app/(app)/progress/loading";
import CommunityLoading from "../src/app/(app)/community/loading";
import AdminLoading from "../src/app/(owner)/admin/loading";
import ProgramsLoading from "../src/app/(owner)/admin/programs/loading";

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

const SCREENS = {
  today: TodayLoading,
  plan: PlanLoading,
  nutrition: NutritionLoading,
  progress: ProgressLoading,
  community: CommunityLoading,
  admin: AdminLoading,
  programs: ProgramsLoading,
} as const;

// --- every screen's skeleton is a well-formed live region ---------------
for (const [name, Component] of Object.entries(SCREENS)) {
  const html = renderToStaticMarkup(React.createElement(Component));

  // A skeleton is invisible to a screen reader; without these the screen
  // silently swaps, which is worse than the freeze it replaced.
  check(`${name}: marks itself busy`, html.includes('aria-busy="true"'), true);
  check(`${name}: is a polite status region`, html.includes('role="status"') && html.includes('aria-live="polite"'), true); // prettier-ignore
  check(
    `${name}: announces something to assistive tech`,
    /class="sr-only">[^<]+</.test(html),
    true,
  );

  // The blocks themselves, and the class the stylesheet animates.
  const blocks = (html.match(/class="skeleton/g) ?? []).length;
  check(`${name}: renders skeleton blocks`, blocks > 0, true);

  // Decorative by definition — the live region carries the meaning, so the
  // individual grey blocks must not be announced one by one.
  const ariaHidden = (html.match(/aria-hidden="true"/g) ?? []).length;
  check(`${name}: every block is aria-hidden`, ariaHidden, blocks);
}

// --- Today's skeleton mirrors its focal card ----------------------------
// The one screen whose shape is distinctive: a tall start card above smaller
// rows. A stack of uniform rows here would misrepresent it.
const todayHtml = renderToStaticMarkup(React.createElement(TodayLoading));
check(
  "today: has a tall focal block (h-44)",
  /class="skeleton[^"]*"[^>]*/.test(todayHtml) && todayHtml.includes("h-44"),
  true,
);
check(
  "today: has smaller rows beneath it",
  todayHtml.includes("h-16"),
  true,
);
// If these two ever match, the focal card has stopped being focal.
check(
  "today: the focal block and the rows are different heights",
  todayHtml.includes("h-44") && !todayHtml.includes("h-44 w-full rounded-lg"),
  true,
);

// --- the admin overview mirrors its four stat tiles ---------------------
const adminHtml = renderToStaticMarkup(React.createElement(AdminLoading));
check(
  "admin: renders four tile blocks",
  (adminHtml.match(/h-28/g) ?? []).length,
  4,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll skeleton checks passed.");
