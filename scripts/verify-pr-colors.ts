// Fixture tests for the PR-type color map (Marcus validation feedback, 2026-09-23).
// Run with:
//   pnpm exec tsx scripts/verify-pr-colors.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// The contract: the two PR types must never render the same color again.
// weight -> --pr-weight (#2563EB blue), in_range_rep -> --pr-rep (#7C3AED violet).
// Both are tokens (bg-pr-*/text-pr-*), never raw hex, so the theme stays the
// single source of truth. This map is also the legend for the future
// per-exercise PR graph, so drift here would silently mis-label that chart.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  PR_TYPE_STYLE,
  prTypeStyle,
  type PRType,
  type PRTypeStyle,
} from "../src/lib/methodology/pr-colors";
import { Constants } from "../src/lib/supabase/types";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// --- every DB pr_type value has a style -------------------------------------
const dbPrTypes = Constants.public.Enums.pr_type_enum;
check("pr_type_enum is [weight, in_range_rep]", [...dbPrTypes], [
  "weight",
  "in_range_rep",
]);

for (const prType of dbPrTypes) {
  check(
    `${prType} has a style entry`,
    typeof PR_TYPE_STYLE[prType] === "object" && PR_TYPE_STYLE[prType] !== null,
    true,
  );
  check(`prTypeStyle(${prType}) === PR_TYPE_STYLE[${prType}]`, prTypeStyle(prType), PR_TYPE_STYLE[prType]);
}

// --- weight = blue, rep = violet --------------------------------------------
check("weight pill uses the pr-weight token", PR_TYPE_STYLE.weight.pill, "bg-pr-weight text-white");
check("rep pill uses the pr-rep token", PR_TYPE_STYLE.in_range_rep.pill, "bg-pr-rep text-white");
check("weight text uses the pr-weight token", PR_TYPE_STYLE.weight.text, "text-pr-weight");
check("rep text uses the pr-rep token", PR_TYPE_STYLE.in_range_rep.text, "text-pr-rep");

// --- the two types are distinguishable on EVERY field -----------------------
// This is the actual bug guard: a copy/paste that leaves both types sharing a
// color or label fails here rather than shipping an indistinguishable UI.
const fields: (keyof PRTypeStyle)[] = [
  "pill",
  "text",
  "surface",
  "shortLabel",
  "label",
  "inlineLabel",
];
for (const field of fields) {
  check(
    `weight and rep differ on "${field}"`,
    PR_TYPE_STYLE.weight[field] !== PR_TYPE_STYLE.in_range_rep[field],
    true,
  );
}

// --- no raw hex anywhere in the map (tokens only) ---------------------------
for (const [prType, style] of Object.entries(PR_TYPE_STYLE) as [
  PRType,
  PRTypeStyle,
][]) {
  for (const field of fields) {
    check(
      `${prType}.${field} carries no hardcoded hex`,
      /#[0-9a-fA-F]{3,8}\b/.test(style[field]),
      false,
    );
  }
}

// --- the tokens the classes reference actually exist ------------------------
const globalsCss = readFileSync(join(repoRoot, "src/app/globals.css"), "utf8");
check(
  "--pr-weight is defined as the #2563EB rgb triplet",
  /--pr-weight:\s*37\s+99\s+235\s*;/.test(globalsCss),
  true,
);
check(
  "--pr-rep is defined as the #7C3AED rgb triplet",
  /--pr-rep:\s*124\s+58\s+237\s*;/.test(globalsCss),
  true,
);

const tailwindConfig = readFileSync(join(repoRoot, "tailwind.config.ts"), "utf8");
check(
  "tailwind maps pr-weight to the token",
  tailwindConfig.includes('"pr-weight": "rgb(var(--pr-weight) / <alpha-value>)"'),
  true,
);
check(
  "tailwind maps pr-rep to the token",
  tailwindConfig.includes('"pr-rep": "rgb(var(--pr-rep) / <alpha-value>)"'),
  true,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pr-colors checks passed.");
