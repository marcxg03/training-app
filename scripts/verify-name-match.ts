// Fixture tests for the shared catalog name matcher (Slice T2-F).
// Run with:
//   pnpm exec tsx scripts/verify-name-match.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHY THIS EXISTS: the matcher was hardened during the T2-A dry-runs against
// a string of REAL false positives — each guard in name-match.ts was added to
// kill a specific wrong pairing that a plain word-overlap score produced. T2-F
// extracted the matcher so a SECOND catalog could use it, which is exactly the
// moment those hard-won guards are at risk of being tuned away by someone
// chasing coverage on the new catalog. Every false positive below is one that
// actually happened; if a future edit resurrects it, this file goes red.
//
// WRITTEN TO FAIL FIRST: before src/lib/catalog/name-match.ts exists this
// import throws (module not found) — red.
import {
  buildIndex,
  findDanglingAliases,
  findMatch,
  headToken,
  matchKey,
  stem,
  tokenize,
  weightedDice,
  buildIdf,
} from "../src/lib/catalog/name-match";

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

// --- stemming ----------------------------------------------------------
check("stem: dips -> dip", stem("dips"), "dip");
check("stem: lunges -> lunge", stem("lunges"), "lunge");
check("stem: raises -> raise", stem("raises"), "raise");
check("stem: flies -> fly", stem("flies"), "fly");
// The double-s guard: without it "press" becomes "pres" and "triceps" becomes
// "tricep", and every press in the library stops matching every press.
check("stem: press is untouched", stem("press"), "press");
// "triceps" ends in "ps", not "ss", so it folds — deliberately. Both catalog
// spellings ("Tricep"/"Triceps" Pushdown) land on the same token.
check("stem: triceps folds to tricep", stem("triceps"), "tricep");
check("stem: tricep is already stemmed", stem("tricep"), "tricep");
// T2-F REGRESSION GUARD. The old `length > 3` bound left "ups" alone, so
// "Weighted Pull Ups" (head "ups") could never match "Pull-Up" (head "up")
// and every pull-up variant in the library went unmatched.
check("stem: ups -> up", stem("ups"), "up");
check("stem: abs -> ab", stem("abs"), "ab");
check("stem: two-letter tokens untouched", stem("is"), "is");

// --- shorthand expansion -----------------------------------------------
check("expands BB", tokenize("BB Row"), ["barbell", "row"]);
check("expands DB", tokenize("DB Curl"), ["dumbbell", "curl"]);
check("expands RDL", tokenize("BB RDL"), ["barbell", "romanian", "deadlift"]);
check("expands SA", tokenize("SA Cable Row"), ["single", "arm", "cable", "row"]); // prettier-ignore
// T2-F additions.
check("expands SL", tokenize("SL DB RDL"), ["single", "leg", "dumbbell", "romanian", "deadlift"]); // prettier-ignore
check("drops ROM (a range qualifier, not a movement)", tokenize("Full ROM Pull Ups"), ["full", "pull", "up"]); // prettier-ignore
// Both spellings converge, via the stemmer rather than an expansion.
check("tricep and triceps converge", tokenize("Tricep Pushdown"), tokenize("Triceps Pushdown")); // prettier-ignore

// Stop tokens are dropped; order does not survive into the key, but content does.
check("drops stop words", matchKey("Bent Over Row with Barbell"), "bent over row barbell"); // prettier-ignore

// --- head-noun gate ----------------------------------------------------
// This is THE guard. A high word-overlap score alone is not evidence that two
// names are the same movement; the movement noun has to agree.
check("head reads past 'machine'", headToken(tokenize("Rear Delt Fly Machine")), "fly"); // prettier-ignore
check("head reads past 'cable'", headToken(tokenize("Pullover Cable")), "pullover");
check("head of a row is row", headToken(tokenize("Seated Cable Row")), "row");
check("head of a crunch is crunch", headToken(tokenize("Cable Seated Crunch")), "crunch"); // prettier-ignore
check("chin-up and pull-up share a head", headToken(tokenize("Chin Up")), headToken(tokenize("Pull Up"))); // prettier-ignore
check("flye normalizes to fly", headToken(tokenize("Cable Flye")), "fly");

// --- the regression catalog --------------------------------------------
// Real entries from the two catalogs, chosen so the historical false
// positives are reachable: if the head gate is removed, several of the
// assertions below flip.
const CATALOG = [
  { name: "Seated Cable Rows" },
  { name: "Cable Seated Crunch" },
  { name: "Single-Arm Cable Crossover" },
  { name: "Single-Arm Cable Row" },
  { name: "Romanian Deadlift" },
  { name: "Barbell Deadlift" },
  { name: "Deadlift" },
  { name: "Lat Pulldown" },
  { name: "Straight-Arm Pulldown" },
  { name: "Low Cable Triceps Extension" },
  { name: "Back Extension" },
  { name: "Lateral Raise" },
  { name: "Front Raise" },
  { name: "Bench Press" },
  { name: "Overhead Press" },
  { name: "Push Press" },
  { name: "Pec Deck" },
  { name: "Face Pull" },
  { name: "Hip Thrust" },
  { name: "Weighted Dip" },
  { name: "Bench Dip" },
  { name: "Pull-Up" },
  { name: "Weighted Pull-Up" },
];

const index = buildIndex(CATALOG);

function matchName(name: string, minScore = 0.65) {
  const result = findMatch(name, index, minScore);
  return result && result.how !== "none" ? result.entry.name : null;
}

// Exact matching, and order-insensitivity WITHIN the token set. The head noun
// is positional by design (it is the last token), so scoring ignores word
// order but the movement noun must still land last — "Pulldown Lat" is not a
// name anyone writes, whereas the row phrasings below both occur in the wild.
check("exact match", matchName("Lat Pulldown"), "Lat Pulldown");
check("order-insensitive within the set", matchName("Bent Over Single-Arm Cable Row"), "Single-Arm Cable Row"); // prettier-ignore
// The bug the `> 2` stem bound fixes, asserted end-to-end: Marcus writes the
// plural, every catalog writes the singular.
check("plural pull ups match the catalog singular", matchName("Weighted Pull Ups"), "Weighted Pull-Up"); // prettier-ignore
check("bodyweight pull ups match too", matchName("Bodyweight Pull Ups"), "Pull-Up"); // prettier-ignore

// FALSE POSITIVE #1 (T2-A): "Seated Cable Row" scored highest against
// "Cable Seated Crunch" — three of four tokens overlap. The head gate
// (row ≠ crunch) is what rejects it.
check("row never lands on crunch", matchName("Seated Cable Row"), "Seated Cable Rows"); // prettier-ignore

// FALSE POSITIVE #2 (T2-A): "SA Cable Kneeling Pulldown" landed on
// "Single-Arm Cable Crossover" — "single", "arm" and "cable" all overlap.
// The head gate confines the search to pulldowns, and none of those clears
// the threshold, so the safe answer is no match rather than the crossover.
check("pulldown never lands on crossover", matchName("SA Cable Kneeling Pulldown"), null); // prettier-ignore
check("...and the near-miss stays inside the pulldowns", findMatch("SA Cable Kneeling Pulldown", index, 0.65)?.entry.name, "Straight-Arm Pulldown"); // prettier-ignore

// FALSE POSITIVE #3 (T2-A): plain Dice tied "BB Romanian Deadlift" onto
// "Barbell Deadlift" because "barbell" counted as much as "romanian". IDF
// weighting picks the rare, distinctive word.
check("IDF prefers the distinctive word", matchName("BB Romanian Deadlift"), "Romanian Deadlift"); // prettier-ignore

// FALSE POSITIVE #4 (T2-A): "Low Back Extensions" matched "Low Cable Triceps
// Extension" at 0.61 — which is why the applied threshold was raised to 0.65.
check("0.61 near-miss is rejected at the 0.65 threshold", matchName("Low Back Extensions", 0.65), "Back Extension"); // prettier-ignore

// A genuine no-match must report null rather than the nearest thing.
check("unrelated name finds no head match", matchName("Dragon Staff"), null);
check("near-miss below threshold is rejected", matchName("Tib Raises", 0.65), null); // prettier-ignore

// `how: "none"` carries the near-miss for the dry-run report rather than
// throwing it away — the unmatched table shows what a name almost hit.
const nearMiss = findMatch("Tib Raises", index, 0.65);
check("near-miss is reported as none", nearMiss?.how, "none");
check("near-miss still names the candidate", nearMiss?.entry.name, "Lateral Raise"); // prettier-ignore

// --- aliases -----------------------------------------------------------
// The alias table is consulted BEFORE scoring, so a curated pairing always
// beats the fuzzy matcher. This is how T2-F reaches names the matcher cannot
// (a "Bayesian Curl" shares no informative token with any catalog name).
const ALIASES = { "military press": "Overhead Press" };
const aliased = findMatch("Military Press", index, 0.65, ALIASES);
check("alias wins over fuzzy", aliased?.entry.name, "Overhead Press");
check("alias is reported as such", aliased?.how, "alias");
// Without the alias the name shares only "press" with every press in the
// catalog, clears no threshold, and is dropped — the exact reason the alias
// table exists. Its nearest miss is some OTHER press (here "Bench Press";
// against the real figure catalog it was "Push Press") — never the overhead
// press it actually is, which no amount of threshold tuning would fix.
check("unaliased Military Press finds nothing", matchName("Military Press"), null); // prettier-ignore
const militaryNearMiss = findMatch("Military Press", index, 0.65)?.entry.name;
check("...and its near-miss is the wrong press", militaryNearMiss !== "Overhead Press" && String(militaryNearMiss).includes("Press"), true); // prettier-ignore

// An alias pointing at a name no catalog has is a typo, and must be loud.
check(
  "dangling alias is detected",
  findDanglingAliases(index, { "some lift": "Not In The Catalog" }),
  ["some lift -> Not In The Catalog"],
);
check("valid alias is not flagged", findDanglingAliases(index, ALIASES), []);

// --- scoring properties -------------------------------------------------
const idf = buildIdf(CATALOG);
check("identical token sets score 1", weightedDice(["row"], ["row"], idf), 1);
check("disjoint token sets score 0", weightedDice(["row"], ["curl"], idf), 0);
check("empty left scores 0", weightedDice([], ["row"], idf), 0);
check("empty right scores 0", weightedDice(["row"], [], idf), 0);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll name-match checks passed.");
