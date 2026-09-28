// Fixture tests for the `exercises.notes` hygiene predicates (Slice T2-E).
// Run with:
//   pnpm exec tsx scripts/verify-exercise-notes.ts
// Exits non-zero on any failure. No test framework needed (repo idiom).
//
// WHAT THIS GUARDS. Marcus's logger picker was printing "Compound\nCompound\n
// Compound" under 39 of his 83 exercises. `scripts/clean-exercise-notes.ts`
// clears those rows and the seed parser stops writing them — both decide what
// to clear with `isTypeOnlyNote`, so this file is where that decision is
// pinned.
//
// THE WHOLE RISK IS THE FALSE POSITIVE. Clearing a note is destructive, and
// SIX of Marcus's 26 real notes contain a type word inside real text
// ("Compound — PR", "Isolation (ATG day)", "Lower Compound day"). Every one of
// those is a case below, quoted exactly as it appears in his data. If a change
// to the predicate ever starts matching them, this script goes red before the
// cleaner ever touches the table.
//
// The MUST-CLEAR and MUST-KEEP corpora below are the measured shapes from his
// account (83 exercises: 39 junk · 26 real · 18 empty).
import {
  EXERCISE_TYPE_WORDS,
  isTypeOnlyNote,
  mergeExerciseNotes,
} from "../src/lib/methodology/exercise-notes";

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

// --- MUST CLEAR: the junk, exactly as it sits in the table -----------------
// The stutter is the merge artefact (one line per round the exercise appears
// in); the single-word forms are what a single-round exercise got.
const MUST_CLEAR: string[] = [
  "Compound\nCompound\nCompound",
  "Isolation\nIsolation\nIsolation",
  "Compound\nCompound",
  "Compound",
  "Isolation",
  "compound",
  "ISOLATION",
  "  Compound  ",
  "Compound\n\nCompound",
  "Compound\r\nCompound\r\nCompound",
  "Compound\nIsolation",
  "Accessory",
  "Failure",
  "Mobility",
  "Corrective",
  "\nCompound\n",
];

for (const notes of MUST_CLEAR) {
  check(
    `type-only → clear: ${JSON.stringify(notes)}`,
    isTypeOnlyNote(notes),
    true,
  );
}

// --- MUST KEEP: Marcus's REAL notes ----------------------------------------
// The first six are the trap: they contain a type word and are information.
const MUST_KEEP: string[] = [
  "Compound — PR",
  "Isolation (ATG day)",
  "Lower Compound day",
  "Compound - PR",
  "Compound day",
  "Isolation, ATG day",
  "Lats / Teres Major",
  "Upper Back",
  "ATG day",
  "Primary",
  "Current primary focus.",
  "Minimum once per week across abs rounds.",
  "Two sets for skill and power before the main pull work.",
  "Hinge strength anchor.",
  "Rear Delts",
  "Quads",
  // A real note that happens to sit ALONGSIDE a junk line is still real — the
  // cleaner must not take the whole cell because one of its lines is noise.
  "Compound\nLats / Teres Major",
  "Lats / Teres Major\nCompound",
  // Punctuation is NOT stripped before the comparison: a note the author
  // bothered to punctuate is left for a human to decide about.
  "Compound.",
  "Isolation!",
];

for (const notes of MUST_KEEP) {
  check(
    `real note → keep: ${JSON.stringify(notes)}`,
    isTypeOnlyNote(notes),
    false,
  );
}

// --- the empty tier: nothing to clear --------------------------------------
check("empty string is not type-only", isTypeOnlyNote(""), false);
check("whitespace only is not type-only", isTypeOnlyNote("   \n\t\n "), false);
check("newlines only are not type-only", isTypeOnlyNote("\n\n\n"), false);

// --- every declared type word is covered -----------------------------------
for (const word of EXERCISE_TYPE_WORDS) {
  check(`declared type word "${word}" is type-only`, isTypeOnlyNote(word), true);
  check(
    `declared type word "${word}" inside real text is NOT type-only`,
    isTypeOnlyNote(`${word} day — heaviest set`),
    false,
  );
}

// --- mergeExerciseNotes: the stutter can never be built again ---------------
check(
  "merge de-duplicates the identical note (the round-merge bug)",
  mergeExerciseNotes("Compound", "Compound"),
  "Compound",
);
check(
  "merge de-duplicates case-insensitively",
  mergeExerciseNotes("Compound", "compound"),
  "Compound",
);
check(
  "merge de-duplicates against an already-stuttered value",
  mergeExerciseNotes("Compound\nCompound", "Compound"),
  "Compound",
);
check(
  "merge keeps genuinely different lines, first-seen order",
  mergeExerciseNotes("Lats / Teres Major", "Upper Back"),
  "Lats / Teres Major\nUpper Back",
);
check("merge with an empty left side", mergeExerciseNotes("", "Upper Back"), "Upper Back"); // prettier-ignore
check("merge with an empty right side", mergeExerciseNotes("ATG day", ""), "ATG day"); // prettier-ignore
check("merge of two empties", mergeExerciseNotes("", ""), "");
check(
  "merge trims and drops blank lines",
  mergeExerciseNotes("  ATG day  \n\n", "\n  Primary  "),
  "ATG day\nPrimary",
);
check(
  "merge is idempotent — re-merging its own output changes nothing",
  mergeExerciseNotes(
    mergeExerciseNotes("Lats / Teres Major", "Upper Back"),
    "Lats / Teres Major",
  ),
  "Lats / Teres Major\nUpper Back",
);

// --- the two working together: a merged stutter collapses to clearable ------
check(
  "merged stutter is still recognised as type-only",
  isTypeOnlyNote(mergeExerciseNotes("Compound", "Compound")),
  true,
);
check(
  "a merged real+junk note is NOT clearable",
  isTypeOnlyNote(mergeExerciseNotes("Compound", "Lats / Teres Major")),
  false,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll exercise-notes checks passed");
