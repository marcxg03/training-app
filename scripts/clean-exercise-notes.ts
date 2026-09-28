// Clear the type-label junk out of `exercises.notes` (Slice T2-E).
//
// THE PROBLEM THIS FIXES: the logger's exercise picker prints `exercise.notes`
// under every option, and on Marcus's account 39 of 83 exercises carry
// "Compound\nCompound\nCompound" or "Isolation\nIsolation\nIsolation" — the
// plan's TYPE column, written into a free-text field and stuttered once per
// round the exercise appears in. It is noise in the one place he reads
// mid-workout. The classification itself lives in `is_compound` (D28, populated
// by scripts/classify-compounds.ts), so nothing is lost by clearing it.
//
// The SOURCE is fixed separately (supabase/seed/lib/methodology-rules.ts drops a
// type-only note at the point it reads the markdown, and both merge points now
// de-duplicate lines), so a re-seed cannot write this back. This script only
// cleans what is already in the table.
//
// The decision of WHAT to clear is `isTypeOnlyNote` in
// src/lib/methodology/exercise-notes.ts — pure, and unit-tested against
// Marcus's real notes by scripts/verify-exercise-notes.ts. This file is only
// the I/O shell around it.
//
// WHAT IT WILL NOT TOUCH: any note carrying text beyond the type words. That
// includes the traps — "Compound — PR", "Isolation (ATG day)",
// "Lower Compound day" — which mention a type word and are real notes. When in
// doubt the row is KEPT; a missed tidy-up is recoverable, a deleted note is not.
//
// SAFETY
//   - DRY-RUN BY DEFAULT. Nothing is written without an explicit --apply.
//   - Every read AND every write is scoped to the --user you pass. There is no
//     global code path: omit --user and the script refuses to run.
//   - Only rows that actually change are written, so a re-run is a no-op.
//   - Uses the service-role key (same as the seed script), so pass the right
//     user id — RLS will not catch a typo for you.
//
// USAGE
//   # 1. look at what it would do (no writes):
//   pnpm exec tsx --env-file=.env.local scripts/clean-exercise-notes.ts --user <uuid>
//   # 2. once the KEEP column looks right:
//   pnpm exec tsx --env-file=.env.local scripts/clean-exercise-notes.ts --user <uuid> --apply
//
//   --user <uuid>   REQUIRED. The auth.users id whose exercise notes to clean.
//   --apply         Perform the UPDATEs. Without it the script only prints.
//   --dry-run       Explicit default; accepted so the intent can be spelled out.

import { createSupabaseAdminClient } from "../supabase/seed/lib/supabase-admin";
import { isTypeOnlyNote } from "../src/lib/methodology/exercise-notes";

type Args = {
  userId: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  let userId = "";
  let apply = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--user" || arg === "--user-id") {
      userId = argv[i + 1] ?? "";
      i++;
      continue;
    }

    if (arg.startsWith("--user=")) {
      userId = arg.slice("--user=".length);
      continue;
    }

    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      apply = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (userId.trim().length === 0) {
    throw new Error(
      "--user <uuid> is REQUIRED. This script never writes globally; it must be scoped to one user.",
    );
  }

  return { userId: userId.trim(), apply };
}

type ExerciseRow = {
  exercise_id: string;
  name: string;
  notes: string | null;
};

type Verdict = "CLEAR" | "KEEP" | "EMPTY";

type Proposal = {
  exercise_id: string;
  name: string;
  notes: string;
  verdict: Verdict;
};

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

/** One-line rendering of a possibly multi-line note, so the table stays a
 * table. The literal "\n" is what makes the stutter legible in the report. */
function inline(notes: string): string {
  return notes.replace(/\r?\n/g, "\\n");
}

function printTable(proposals: Proposal[]): void {
  const nameWidth = Math.min(
    34,
    Math.max(12, ...proposals.map((p) => p.name.length)),
  );

  console.log("");
  console.log(`  ${pad("EXERCISE", nameWidth)}  ${pad("VERDICT", 8)}  NOTES`);
  console.log(`  ${"─".repeat(nameWidth + 50)}`);

  for (const p of proposals) {
    console.log(
      `  ${pad(p.name, nameWidth)}  ${pad(p.verdict, 8)}  ${
        p.verdict === "EMPTY" ? "—" : inline(p.notes)
      }`,
    );
  }
}

async function main(): Promise<void> {
  const { userId, apply } = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();

  console.log("════════════════════════════════════════════════════════");
  console.log("  clean-exercise-notes · clear type-label-only notes");
  console.log(`  user:  ${userId}`);
  console.log(`  mode:  ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("════════════════════════════════════════════════════════");

  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_id, name, notes")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to read exercises: ${error.message}`);
  }

  const rows = (data ?? []) as ExerciseRow[];

  if (rows.length === 0) {
    console.log(
      "\nNo exercises found for that user. Check the --user id (this script is scoped, never global).",
    );
    return;
  }

  const proposals: Proposal[] = rows.map((row) => {
    const notes = row.notes ?? "";
    const verdict: Verdict =
      notes.trim().length === 0
        ? "EMPTY"
        : isTypeOnlyNote(notes)
          ? "CLEAR"
          : "KEEP";

    return { exercise_id: row.exercise_id, name: row.name, notes, verdict };
  });

  printTable(proposals);

  const toClear = proposals.filter((p) => p.verdict === "CLEAR");
  const toKeep = proposals.filter((p) => p.verdict === "KEEP");
  const empty = proposals.filter((p) => p.verdict === "EMPTY");

  console.log("");
  console.log(`  total exercises        ${proposals.length}`);
  console.log(`  → CLEAR (junk)         ${toClear.length}`);
  console.log(`  → KEEP  (real notes)   ${toKeep.length}`);
  console.log(`  → EMPTY (already '')   ${empty.length}`);

  // The traps, called out by name: real notes that CONTAIN a type word and are
  // being kept. If one of these ever shows up under CLEAR, stop.
  const nearMisses = toKeep.filter((p) =>
    /\b(compound|isolation|accessory|failure|mobility|corrective)\b/i.test(
      p.notes,
    ),
  );

  if (nearMisses.length > 0) {
    console.log("");
    console.log(
      `  note: ${nearMisses.length} KEPT note(s) mention a type word and were left alone:`,
    );
    for (const p of nearMisses) {
      console.log(`        ${p.name}: ${inline(p.notes)}`);
    }
  }

  if (!apply) {
    console.log("");
    console.log(
      "  DRY-RUN — nothing written. Re-run with --apply once the KEEP column looks right.",
    );
    return;
  }

  if (toClear.length === 0) {
    console.log("\n  Nothing to write — no type-only notes left.");
    return;
  }

  console.log("");
  let written = 0;

  for (const proposal of toClear) {
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ notes: "" })
      .eq("exercise_id", proposal.exercise_id)
      // Belt AND braces: the id is already unique, but scoping the write to the
      // user makes a wrong-id update impossible to land on someone else's row.
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(
        `Failed to clear "${proposal.name}": ${updateError.message}`,
      );
    }

    written++;
    console.log(`  ✓ ${proposal.name} → notes cleared`);
  }

  console.log("");
  console.log(`  APPLIED — ${written} row(s) cleared.`);
}

main().catch((error: unknown) => {
  console.error(`\nclean-exercise-notes failed: ${(error as Error).message}`);
  process.exit(1);
});
