// Fixture tests for the owner-gate (Slice S0, D22).
// Run with:
//   pnpm exec tsx scripts/verify-owner-gate.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// D22: owner-gating is a server-side isOwner(userId) reading the comma-separated
// env var OWNER_USER_IDS. FAIL-CLOSED: unset/empty env ⇒ nobody is an owner;
// a null/undefined userId is never an owner.
//
// WRITTEN TO FAIL FIRST: before src/lib/auth/owner.ts exists this import throws
// (module not found) — red. Once the module is implemented to the contract
// below, every case passes — green.
//
// isOwner reads process.env at CALL time, so the cases below mutate
// OWNER_USER_IDS between assertions.
//
// S6 (D25): also structurally assert the `(owner)/` route group gates /admin.
// The guard is a server component (`requireOwner()` in the group layout), so a
// pure runtime test can't drive it without Supabase — instead we assert the
// STRUCTURE that makes /admin owner-only: the admin page sits under the
// `(owner)` group, and that group's layout awaits requireOwner().
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isOwner } from "../src/lib/auth/owner";

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

// --- with a populated owner list ---------------------------------------
process.env.OWNER_USER_IDS = "abc,def";
check("listed id abc is owner", isOwner("abc"), true);
check("listed id def is owner", isOwner("def"), true);
check("unlisted id xyz is not owner", isOwner("xyz"), false);
check("null userId is not owner", isOwner(null), false);
check("undefined userId is not owner", isOwner(undefined), false);
check("empty-string userId is not owner", isOwner(""), false);

// --- whitespace / formatting tolerance ---------------------------------
process.env.OWNER_USER_IDS = " abc , def ";
check("trims surrounding whitespace in the list", isOwner("abc"), true);
check("trims surrounding whitespace (def)", isOwner("def"), true);

// --- fail-closed: empty / unset env ⇒ nobody is an owner ----------------
process.env.OWNER_USER_IDS = "";
check("empty env ⇒ listed-looking id is not owner", isOwner("abc"), false);

delete process.env.OWNER_USER_IDS;
check("unset env ⇒ not owner", isOwner("abc"), false);
check("unset env ⇒ null not owner", isOwner(null), false);

// --- single-id list, no commas -----------------------------------------
process.env.OWNER_USER_IDS = "solo-owner-id";
check("single-id list matches", isOwner("solo-owner-id"), true);
check("single-id list rejects others", isOwner("someone-else"), false);

// --- S6 structural coverage: /admin is owner-gated by the (owner) group -----
const repoRoot = join(__dirname, "..");
const ownerLayoutRaw = readFileSync(
  join(repoRoot, "src/app/(app)/(owner)/layout.tsx"),
  "utf8",
);
// Strip comments so a commented-out guard (`// await requireOwner();` or a
// block-commented call) does NOT satisfy the structural assertion below.
const ownerLayout = ownerLayoutRaw
  .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
  .replace(/\/\/[^\n]*/g, ""); // line comments
const adminPageExists = (() => {
  try {
    readFileSync(join(repoRoot, "src/app/(app)/(owner)/admin/page.tsx"), "utf8");
    return true;
  } catch {
    return false;
  }
})();

check(
  "(owner) group layout imports requireOwner",
  /requireOwner/.test(ownerLayout),
  true,
);
check(
  "(owner) group layout awaits requireOwner() (structural gate)",
  /await\s+requireOwner\s*\(/.test(ownerLayout),
  true,
);
check(
  "/admin lives under the (owner) group (so it inherits the gate)",
  adminPageExists,
  true,
);

if (failures > 0) {
  console.error(`\n${failures} owner-gate assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll owner-gate assertions passed.");
