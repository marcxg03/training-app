// Fixture tests for the admin hub's navigation model (T3-A). Run with:
//   pnpm exec tsx scripts/verify-admin-nav.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS
//   The hub root is "/admin" and every section is a child of it, so a
//   prefix-only active-match — which is what the mobile tab bar uses — would
//   light "Overview" on EVERY page of the hub and show two active items at
//   once. That is a genuine bug the mobile helper cannot be reused to avoid,
//   and it is invisible to typecheck/lint. Pinned here.
//
// WRITTEN TO FAIL FIRST: before src/lib/nav/admin.ts exists this import throws.
import {
  ADMIN_SECTIONS,
  activeAdminSection,
  isAdminSectionActive,
} from "../src/lib/nav/admin";

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

// --- the root special-case (the whole reason this module exists) ---------
check("root matches itself", isAdminSectionActive("/admin", "/admin"), true);
check(
  "root does NOT match a child route",
  isAdminSectionActive("/admin/programs", "/admin"),
  false,
);
check(
  "root does NOT match a deep child",
  isAdminSectionActive("/admin/programs/abc/edit", "/admin"),
  false,
);

// --- section matching ---------------------------------------------------
check(
  "section matches itself",
  isAdminSectionActive("/admin/programs", "/admin/programs"),
  true,
);
check(
  "section matches its children",
  isAdminSectionActive("/admin/programs/abc", "/admin/programs"),
  true,
);
check(
  "section matches a deep child",
  isAdminSectionActive("/admin/programs/abc/edit", "/admin/programs"),
  true,
);
check(
  "section does not match a sibling",
  isAdminSectionActive("/admin/analytics", "/admin/programs"),
  false,
);
// A sibling whose path merely starts with the same characters must not match:
// "/admin/programsomething" is not inside "/admin/programs".
check(
  "prefix match respects the path separator",
  isAdminSectionActive("/admin/programsomething", "/admin/programs"),
  false,
);
check(
  "a non-hub route matches nothing",
  isAdminSectionActive("/today", "/admin"),
  false,
);

// --- the authoring surfaces at their own URLs (T3-B) --------------------
// /library/** and /plan/edit are part of the hub but keep their historical
// paths, because a route group never changes a URL and those paths are linked
// from elsewhere. The sidebar has to claim them or the owner editing an
// exercise sees NO active section and the builder looks like it fell away.
check("library is a section", isAdminSectionActive("/library", "/library"), true); // prettier-ignore
check("a library child is claimed", isAdminSectionActive("/library/exercises", "/library"), true); // prettier-ignore
check("a deep library child is claimed", isAdminSectionActive("/library/lifting/blocks/abc/edit", "/library"), true); // prettier-ignore

// The Schedule editors moved to /admin/schedule/<day> in T3-B (D45), so they
// need no special matching — but the MEMBER plan routes must still never be
// claimed by any hub section, which is what the old wildcard existed to
// guarantee. Assert that directly instead.
for (const memberRoute of ["/plan", "/plan/mon", "/today", "/progress"]) {
  check(
    `no hub section claims the member route ${memberRoute}`,
    ADMIN_SECTIONS.filter((s) => isAdminSectionActive(memberRoute, s.href))
      .length,
    0,
  );
}
check(
  "schedule claims its own day editor",
  isAdminSectionActive("/admin/schedule/mon", "/admin/schedule"),
  true,
);

// --- exactly one active section, on every hub route ---------------------
// The invariant the sidebar depends on. Asserted over every declared section
// plus a child of each, so adding a section that breaks it fails here.
const ROUTES = [
  "/admin",
  ...ADMIN_SECTIONS.filter((s) => s.href !== "/admin").flatMap((s) => [
    s.href,
    `${s.href}/child`,
  ]),
  "/admin/schedule/mon",
  "/library/exercises",
];

for (const route of ROUTES) {
  const matches = ADMIN_SECTIONS.filter((s) =>
    isAdminSectionActive(route, s.href),
  );
  check(`exactly one active section for ${route}`, matches.length, 1);
}

check(
  "activeAdminSection names the right section",
  activeAdminSection("/admin/programs/abc")?.label,
  "Programs",
);
check("activeAdminSection is null outside the hub", activeAdminSection("/today"), null); // prettier-ignore

// --- the section list itself --------------------------------------------
check("Overview is first", ADMIN_SECTIONS[0].href, "/admin");
// Not every section lives under /admin any more (T3-B): the authoring
// surfaces keep their own URLs. Assert the set explicitly instead.
check(
  "sections cover the hub plus the authoring surfaces",
  ADMIN_SECTIONS.map((s) => s.href),
  [
    "/admin",
    "/admin/programs",
    "/library",
    "/admin/schedule",
    "/admin/analytics",
    "/admin/members",
  ],
);
check(
  "hrefs are unique",
  new Set(ADMIN_SECTIONS.map((s) => s.href)).size,
  ADMIN_SECTIONS.length,
);
// Honesty check: Overview and Programs are built in T3-A/T3-B and must not
// carry the "soon" chip; the marketplace sections must, until they exist.
check(
  "Overview is not marked soon",
  ADMIN_SECTIONS.find((s) => s.href === "/admin")?.soon,
  undefined,
);
check(
  "Programs is not marked soon",
  ADMIN_SECTIONS.find((s) => s.href === "/admin/programs")?.soon,
  undefined,
);
check(
  "Library is not marked soon (it is fully built)",
  ADMIN_SECTIONS.find((s) => s.href === "/library")?.soon,
  undefined,
);
check(
  "Schedule is not marked soon",
  ADMIN_SECTIONS.find((s) => s.href === "/admin/schedule")?.soon,
  undefined,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll admin-nav checks passed.");
