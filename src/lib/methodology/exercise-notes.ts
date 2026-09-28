// `exercises.notes` hygiene — the pure half (T2-E). No React, no Supabase, so
// scripts/verify-exercise-notes.ts can drive it with fixtures and both the seed
// parser and the cleanup script can share ONE definition of "this note says
// nothing".
//
// WHY THIS EXISTS. Marcus opened the logger's exercise picker and found 39 of
// his 83 exercises carrying notes like:
//
//     Compound
//     Compound
//     Compound
//
// Two independent defects produced that:
//
//   1. A **type label reached a free-text field.** "Compound" / "Isolation" is
//      the plan's TYPE column — it belongs to `exercises.is_compound` (which
//      exists and is now populated, D28/T2-A), not to a note. A note repeating
//      the classifier carries no information the row doesn't already hold, and
//      it is the one thing the picker prints under the exercise name.
//   2. A **merge that concatenated without de-duplicating.** The same exercise
//      appears in Round 1, Round 2 and Round 3 of a session; each merge point
//      joined the two notes with "\n" whether or not they were identical, so a
//      one-word note came out the far end stuttered once per round.
//
// Fixing only the data would let the next `pnpm seed` write it all back, so the
// predicate below is used in BOTH places: the parser drops a type-only note at
// the point it is read, and `mergeExerciseNotes` makes a duplicated line
// impossible to stack.
//
// THE TRAP THIS MODULE IS BUILT AROUND: some of Marcus's REAL notes contain the
// junk words — "Compound — PR", "Isolation (ATG day)", "Lower Compound day".
// Those are information. The test is not "does this note mention a type word"
// but "is every line of this note NOTHING BUT a type word" — so anything
// carrying extra text survives untouched.

/** The classifier vocabulary a note may not consist solely of. These are
 * category labels the schema already models (`is_compound`) or the block
 * already models (`block_type`); as a note they are pure noise. */
export const EXERCISE_TYPE_WORDS = [
  "compound",
  "isolation",
  "accessory",
  "failure",
  "mobility",
  "corrective",
] as const;

const TYPE_WORD_SET: ReadonlySet<string> = new Set(EXERCISE_TYPE_WORDS);

/** Non-empty lines, trimmed. `\r\n` included — a note can reach the DB from a
 * markdown table authored on any platform. */
function contentLines(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * True when a note carries NOTHING beyond one or more type words — i.e. it is
 * safe to clear because the information it holds is already in a column.
 *
 * Deliberately strict, because a false positive DELETES one of Marcus's real
 * notes and a false negative merely leaves a tidy-up undone:
 *
 *   - every non-empty line must equal a type word EXACTLY after trimming
 *     (case-insensitive). "Compound — PR" and "Isolation (ATG day)" carry extra
 *     text, so they are kept. So is "Compound." — the trailing period is not
 *     stripped, because stripping punctuation is the first step toward
 *     stripping meaning.
 *   - an empty / whitespace-only note is NOT type-only. There is nothing to
 *     clear, and reporting it as clearable would inflate the cleanup count with
 *     no-op rows.
 */
export function isTypeOnlyNote(notes: string): boolean {
  const lines = contentLines(notes);

  if (lines.length === 0) {
    return false;
  }

  return lines.every((line) => TYPE_WORD_SET.has(line.toLowerCase()));
}

/**
 * Join two notes for the same exercise WITHOUT stuttering. Order is preserved
 * (first occurrence wins) and comparison is case/whitespace-insensitive, so the
 * three-rounds merge that produced "Compound\nCompound\nCompound" now produces
 * "Compound" — and the type-only filter upstream then produces "".
 *
 * Pure string work: it does not decide whether a line is worth keeping, only
 * that it is not already there.
 */
export function mergeExerciseNotes(left: string, right: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const line of [...contentLines(left), ...contentLines(right)]) {
    const key = line.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(line);
  }

  return kept.join("\n");
}
