// One-time data migration: collapse "Chest 1/2/3" onto ONE shared exercise bank.
//
//   node --env-file=.env.local scripts/merge-chest-blocks.mjs           # dry run
//   node --env-file=.env.local scripts/merge-chest-blocks.mjs --apply   # write
//
// Requires migration 024 (blocks.bank_source_block_id).
//
// WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
//
// Upper interleaves chest through the session at positions 1, 4 and 7. Those
// three slots stay three distinct block rows — everything else keys on
// block_id: workout_blocks, set_logs.block_id, and
// workout_completions.completed_block_ids. Deleting or repointing a block would
// destroy or rewrite logged history (set_logs.block_id CASCADEs on delete).
//
// So the three blocks are edited IN PLACE:
//   * Chest 1 becomes "Chest — Round 1" and owns the merged bank (the union of
//     all three banks, first-seen order preserved).
//   * Chest 2 / 3 become "Chest — Round 2" / "Round 3", have their own
//     block_lifting_items removed, and point bank_source_block_id at Round 1.
//
// Because the block rows keep their ids, every workout_blocks row and every
// logged set stays valid and correctly attributed. Nothing propagates because
// nothing moved — the plan already references these exact blocks.
import { writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = process.env.MERGE_OWNER_EMAIL ?? "gaomx9@gmail.com";
const APPLY = process.argv.includes("--apply");

if (!URL || !SERVICE) throw new Error("missing supabase env");
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// Ordered: Round 1 is the source, the rest follow it.
const ROUNDS = [
  { from: "Chest 1", to: "Chest — Round 1" },
  { from: "Chest 2", to: "Chest — Round 2" },
  { from: "Chest 3", to: "Chest — Round 3" },
];

const log = (...args) => console.log(...args);
const fail = (message) => {
  console.error(`ABORT: ${message}`);
  process.exit(1);
};

const { data: userList, error: userError } = await admin.auth.admin.listUsers();
if (userError) fail(userError.message);
const owner = userList.users.find((u) => u.email === OWNER_EMAIL);
if (!owner) fail(`no user ${OWNER_EMAIL}`);

// --- resolve the three blocks (accept either the old or the new name so the
// script is idempotent and can be re-run safely) ---------------------------
const { data: blocks, error: blocksError } = await admin
  .from("blocks")
  .select("block_id, block_name, block_type, block_category, bank_source_block_id")
  .eq("owner_user_id", owner.id);
if (blocksError) fail(blocksError.message);

const resolved = ROUNDS.map((round) => {
  const block = (blocks ?? []).find(
    (b) => b.block_name === round.from || b.block_name === round.to,
  );
  if (!block) fail(`block not found: "${round.from}" (or "${round.to}")`);
  if (block.block_category !== "lifting") {
    fail(`"${block.block_name}" is ${block.block_category}, expected lifting`);
  }
  return { ...round, block };
});

const [source, ...followers] = resolved;

// --- build the merged bank: union across all three, first-seen order --------
const bankByBlockId = new Map();
for (const entry of resolved) {
  const { data: items, error } = await admin
    .from("block_lifting_items")
    .select("exercise_id, display_order, exercises!inner (name)")
    .eq("block_id", entry.block.block_id)
    .order("display_order");
  if (error) fail(error.message);
  bankByBlockId.set(entry.block.block_id, items ?? []);
}

const merged = [];
const seen = new Set();
for (const entry of resolved) {
  for (const item of bankByBlockId.get(entry.block.block_id)) {
    if (seen.has(item.exercise_id)) continue;
    seen.add(item.exercise_id);
    const ex = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
    merged.push({ exercise_id: item.exercise_id, name: ex?.name ?? item.exercise_id });
  }
}

// --- report -----------------------------------------------------------------
log(`\nOwner: ${OWNER_EMAIL}`);
log(`Mode:  ${APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"}\n`);

for (const entry of resolved) {
  const items = bankByBlockId.get(entry.block.block_id);
  const role = entry === source ? "SOURCE — owns the merged bank" : `FOLLOWS "${source.to}"`;
  log(`${entry.block.block_name}  ->  ${entry.to}   [${role}]`);
  log(`   currently ${items.length} exercises, bank_source=${entry.block.bank_source_block_id ?? "none"}`);
}

log(`\nMerged bank (${merged.length} exercises, union in first-seen order):`);
merged.forEach((e, i) => log(`   ${i}. ${e.name}`));

// Safety: logged history must be untouched. Report it so the diff is visible.
let totalSets = 0;
for (const entry of resolved) {
  const { count } = await admin
    .from("set_logs")
    .select("*", { count: "exact", head: true })
    .eq("block_id", entry.block.block_id);
  totalSets += count ?? 0;
}
log(`\nLogged sets across the three blocks: ${totalSets} (must be unchanged after)`);

const { data: usage } = await admin
  .from("workout_blocks")
  .select("workout_id, block_id, display_order")
  .in(
    "block_id",
    resolved.map((r) => r.block.block_id),
  );
log(`workout_blocks rows referencing them: ${(usage ?? []).length} (must be unchanged after)`);

if (!APPLY) {
  log("\nDry run only. Re-run with --apply to write.");
  process.exit(0);
}

// --- apply ------------------------------------------------------------------
// Order matters: clear followers' links first so the one-level trigger can
// never see a transient chain, then set the source's bank, then relink.

// The only undo. Written before anything is destroyed; --apply refuses if the
// snapshot cannot be persisted, because the delete below is irreversible.
const snapshot = {
  taken_for: OWNER_EMAIL,
  blocks: resolved.map((entry) => ({
    block_id: entry.block.block_id,
    block_name: entry.block.block_name,
    bank_source_block_id: entry.block.bank_source_block_id,
    items: bankByBlockId.get(entry.block.block_id).map((item) => ({
      exercise_id: item.exercise_id,
      display_order: item.display_order,
    })),
  })),
};
const snapshotPath = `merge-chest-blocks.backup.${process.pid}.json`;
try {
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
} catch (error) {
  fail(`could not write the pre-merge snapshot (${error.message}) — refusing to write`);
}
log(`\nSnapshot written: ${snapshotPath}`);

/** PostgREST returns no error when an UPDATE matches zero rows, so every write
 * asserts it actually landed. */
const mustUpdateOne = async (query, what) => {
  const { data, error } = await query.select("block_id");
  if (error) fail(`${what}: ${error.message}`);
  if ((data ?? []).length !== 1) fail(`${what}: matched ${(data ?? []).length} rows, expected 1`);
};

log("\nApplying...");

for (const follower of followers) {
  await mustUpdateOne(
    admin
      .from("blocks")
      .update({ bank_source_block_id: null })
      .eq("block_id", follower.block.block_id),
    `unlink ${follower.block.block_name}`,
  );
}

// Source: rename + replace its bank with the merged union.
{
  await mustUpdateOne(
    admin
      .from("blocks")
      .update({ block_name: source.to, bank_source_block_id: null })
      .eq("block_id", source.block.block_id),
    "rename source",
  );

  // Upsert first, prune second: the source is never left with an empty bank,
  // so a crash between the two statements degrades to "a few stale rows"
  // rather than "the merged list is gone".
  const { error: upsertError } = await admin
    .from("block_lifting_items")
    .upsert(
      merged.map((exercise, index) => ({
        block_id: source.block.block_id,
        exercise_id: exercise.exercise_id,
        display_order: index,
      })),
      { onConflict: "block_id,exercise_id" },
    );
  if (upsertError) fail(`write merged bank: ${upsertError.message}`);

  const keep = merged.map((exercise) => exercise.exercise_id);
  const { error: pruneError } = await admin
    .from("block_lifting_items")
    .delete()
    .eq("block_id", source.block.block_id)
    .not("exercise_id", "in", `(${keep.join(",")})`);
  if (pruneError) fail(`prune source bank: ${pruneError.message}`);
  log(`  ${source.to}: bank replaced with ${merged.length} exercises`);
}

for (const follower of followers) {
  const { error: itemsError } = await admin
    .from("block_lifting_items")
    .delete()
    .eq("block_id", follower.block.block_id);
  if (itemsError) fail(`clear ${follower.to} bank: ${itemsError.message}`);

  await mustUpdateOne(
    admin.from("blocks").update({
      block_name: follower.to,
      bank_source_block_id: source.block.block_id,
    }).eq("block_id", follower.block.block_id),
    `link ${follower.to}`,
  );
  log(`  ${follower.to}: own bank cleared, now follows ${source.to}`);
}

// --- verify -----------------------------------------------------------------
let afterSets = 0;
for (const entry of resolved) {
  const { count } = await admin
    .from("set_logs")
    .select("*", { count: "exact", head: true })
    .eq("block_id", entry.block.block_id);
  afterSets += count ?? 0;
}
const { data: afterUsage } = await admin
  .from("workout_blocks")
  .select("block_id")
  .in(
    "block_id",
    resolved.map((r) => r.block.block_id),
  );

log(`\nVerify: logged sets ${totalSets} -> ${afterSets}`);
log(`Verify: workout_blocks rows ${(usage ?? []).length} -> ${(afterUsage ?? []).length}`);
if (afterSets !== totalSets || (afterUsage ?? []).length !== (usage ?? []).length) {
  fail("history or plan wiring changed — investigate before trusting this run");
}

// Re-read the thing the script actually rewrote. The counts above cover tables
// this script never touches, so on their own they can only ever pass.
const { data: sourceItems } = await admin
  .from("block_lifting_items")
  .select("exercise_id, display_order")
  .eq("block_id", source.block.block_id)
  .order("display_order");

if ((sourceItems ?? []).length !== merged.length) {
  fail(
    `source bank has ${(sourceItems ?? []).length} exercises, expected ${merged.length} — restore from ${snapshotPath}`,
  );
}
const wantIds = merged.map((e) => e.exercise_id).join(",");
const gotIds = (sourceItems ?? []).map((r) => r.exercise_id).join(",");
if (wantIds !== gotIds) {
  fail(`source bank contents/order differ from the merge — restore from ${snapshotPath}`);
}

const { data: afterBlocks } = await admin
  .from("blocks")
  .select("block_id, block_name, bank_source_block_id")
  .in("block_id", resolved.map((r) => r.block.block_id));

for (const follower of followers) {
  const row = (afterBlocks ?? []).find((b) => b.block_id === follower.block.block_id);
  if (row?.bank_source_block_id !== source.block.block_id) {
    fail(`${follower.to} is not linked to ${source.to} — restore from ${snapshotPath}`);
  }
  const { count: ownItems } = await admin
    .from("block_lifting_items")
    .select("*", { count: "exact", head: true })
    .eq("block_id", follower.block.block_id);
  if ((ownItems ?? 0) !== 0) {
    fail(`${follower.to} still owns ${ownItems} bank rows — restore from ${snapshotPath}`);
  }
}

// Every exercise the three blocks were ever logged against must still be in
// the merged bank, or past sessions reference something the plan no longer offers.
const { data: loggedExercises } = await admin
  .from("set_logs")
  .select("exercise_id")
  .in("block_id", resolved.map((r) => r.block.block_id));
const mergedSet = new Set(merged.map((e) => e.exercise_id));
const orphaned = [...new Set((loggedExercises ?? []).map((r) => r.exercise_id))].filter(
  (id) => !mergedSet.has(id),
);
if (orphaned.length) {
  log(`\nNOTE: ${orphaned.length} logged exercise(s) are not in the merged bank (history still intact).`);
}

log(`\nDone. Verified: source holds ${merged.length} exercises, both followers linked and bankless.`);
log(`Snapshot kept at ${snapshotPath} — delete it once you are satisfied.`);
