// Backfill `exercises.is_compound` from Marcus's LOCKED D28 list (Slice T2-A).
//
// THE PROBLEM THIS FIXES: `is_compound` has existed since migration 002 and
// `buildE1rmSpotlights` has always excluded non-compound lifts — but nothing
// ever wrote the column, so every row sits on its `false` DEFAULT. The code
// gate is right; the DATA is wrong, which is why estimated-1RM reads wrong.
//
// The classification itself lives in src/lib/methodology/compound-classification.ts
// (pure, unit-tested by scripts/verify-compound-classification.ts). This script
// is only the I/O shell around it.
//
// SAFETY
//   - DRY-RUN BY DEFAULT. Nothing is written without an explicit --apply.
//   - Every read AND every write is scoped to the --user you pass. There is no
//     global code path: omit --user and the script refuses to run.
//   - Only rows whose is_compound actually CHANGES are written; unchanged rows
//     are skipped, so a re-run is a no-op.
//   - Uses the service-role key (same as the seed script), so pass the right
//     user id — RLS will not catch a typo for you.
//
// USAGE
//   # 1. look at what it would do (no writes):
//   pnpm exec tsx --env-file=.env.local scripts/classify-compounds.ts --user <uuid>
//   # 2. once the table looks right:
//   pnpm exec tsx --env-file=.env.local scripts/classify-compounds.ts --user <uuid> --apply
//
//   --user <uuid>   REQUIRED. The auth.users id whose exercises to classify.
//   --apply         Perform the UPDATEs. Without it the script only prints.
//   --dry-run       Explicit default; accepted so the intent can be spelled out.

import { createSupabaseAdminClient } from "../supabase/seed/lib/supabase-admin";
import { explainCompoundClassification } from "../src/lib/methodology/compound-classification";

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
  is_compound: boolean;
  is_bodyweight: boolean;
};

type Proposal = ExerciseRow & {
  proposed: boolean;
  rule: string;
  changes: boolean;
};

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function printTable(proposals: Proposal[]): void {
  const nameWidth = Math.min(
    38,
    Math.max(12, ...proposals.map((p) => p.name.length)),
  );

  console.log("");
  console.log(
    `  ${pad("EXERCISE", nameWidth)}  ${pad("NOW", 5)}  ${pad("→", 5)}  ${pad("Δ", 3)}  RULE`,
  );
  console.log(`  ${"─".repeat(nameWidth + 26)}`);

  for (const p of proposals) {
    console.log(
      `  ${pad(p.name, nameWidth)}  ${pad(String(p.is_compound), 5)}  ${pad(String(p.proposed), 5)}  ${pad(p.changes ? "✎" : "", 3)}  ${p.rule}`,
    );
  }
}

async function main(): Promise<void> {
  const { userId, apply } = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();

  console.log("════════════════════════════════════════════════════════");
  console.log("  classify-compounds · D28 is_compound backfill");
  console.log(`  user:  ${userId}`);
  console.log(`  mode:  ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("════════════════════════════════════════════════════════");

  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_id, name, is_compound, is_bodyweight")
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
    const { isCompound, rule } = explainCompoundClassification(row.name);

    return {
      ...row,
      proposed: isCompound,
      rule,
      changes: isCompound !== row.is_compound,
    };
  });

  printTable(proposals);

  const toCompound = proposals.filter((p) => p.changes && p.proposed);
  const toIsolation = proposals.filter((p) => p.changes && !p.proposed);
  const unchanged = proposals.filter((p) => !p.changes);

  console.log("");
  console.log(`  total exercises        ${proposals.length}`);
  console.log(`  → compound (changed)   ${toCompound.length}`);
  console.log(`  → isolation (changed)  ${toIsolation.length}`);
  console.log(`  unchanged              ${unchanged.length}`);
  console.log(
    `  compound after run     ${proposals.filter((p) => p.proposed).length}`,
  );

  // Bodyweight compounds (pull-ups, dips) are classified compound but stay out
  // of the e1RM surfaces — that gate is is_bodyweight, and it is independent.
  const bodyweightCompounds = proposals.filter(
    (p) => p.proposed && p.is_bodyweight,
  );

  if (bodyweightCompounds.length > 0) {
    console.log("");
    console.log(
      `  note: ${bodyweightCompounds.length} compound(s) are flagged bodyweight and stay out of e1RM`,
    );
    console.log(
      `        (${bodyweightCompounds.map((p) => p.name).join(", ")})`,
    );
  }

  if (!apply) {
    console.log("");
    console.log(
      "  DRY-RUN — nothing written. Re-run with --apply once the table looks right.",
    );
    return;
  }

  const changed = [...toCompound, ...toIsolation];

  if (changed.length === 0) {
    console.log("\n  Nothing to write — the data already matches D28.");
    return;
  }

  console.log("");
  let written = 0;

  for (const proposal of changed) {
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ is_compound: proposal.proposed })
      .eq("exercise_id", proposal.exercise_id)
      // Belt AND braces: the id is already unique, but scoping the write to the
      // user makes a wrong-id update impossible to land on someone else's row.
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(
        `Failed to update "${proposal.name}": ${updateError.message}`,
      );
    }

    written++;
    console.log(`  ✓ ${proposal.name} → is_compound=${proposal.proposed}`);
  }

  console.log("");
  console.log(`  APPLIED — ${written} row(s) updated.`);
}

main().catch((error: unknown) => {
  console.error(`\nclassify-compounds failed: ${(error as Error).message}`);
  process.exit(1);
});
