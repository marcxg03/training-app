// Replace Marcus's stock exercise PHOTOS with animated vector line figures.
// Slice T2-F. See DECISIONS.md D35 (source + licence) and D36 (the corrections
// found when the source was actually opened).
//
// SOURCE: npm `@bryllim/workout-guide` — 302 exercises × 3 frames.
//   Code   MIT.
//   ARTWORK  CC BY-SA 4.0 (Bryl Lim; 76 first-pose frames adapted from
//            Everkinetic, also CC BY-SA 4.0). See the package's LICENSES.md
//            and ATTRIBUTION.md, both vendored alongside the frames.
//
// THE LICENCE RULE (D35, and it is load-bearing): the artwork ships
// **byte-identical**. CC BY-SA's ShareAlike clause bites on *Adapted Material
// that you distribute* — so as long as what leaves the server is the original
// file, the app's own source is not dragged under CC BY-SA. The figures are
// white-on-transparent (drawn for dark UIs) and Marcus's app is warm-white, so
// they are recoloured **in the browser** with a CSS filter at display time.
// That is a rendering choice, not a redistribution of adapted art. The credit
// surface still says the art is shown recoloured, which satisfies the
// "indicate if changes were made" limb under the most conservative reading.
//
//   DO NOT "optimise", recolour, crop, or re-export these PNGs on disk.
//   Doing so makes them Adapted Material and the ShareAlike obligation
//   attaches to whatever you distribute them with.
//
// WHAT THIS DOES **NOT** DO: it does not import the catalog as exercises. Only
// exercises Marcus ALREADY has get a figure; the other ~220 are not his
// library. Same rule as scripts/enrich-exercises.ts (T2-A).
//
// SAFETY
//   - DRY-RUN BY DEFAULT. No DB write and no file write without --apply.
//   - Every read and write is scoped to --user; omit it and the script refuses.
//   - The package is cached under scripts/.cache/ (gitignored) so repeat runs
//     are offline. --refresh forces a re-download.
//   - Matching reuses the hardened matcher (src/lib/catalog/name-match.ts) at
//     the >= 0.65 threshold T2-A settled on after "Low Back Extensions" tried
//     to match "Low Cable Triceps Extension" at 0.61.
//
// USAGE
//   pnpm exec tsx --env-file=.env.local scripts/vendor-figures.ts --user <uuid>
//   pnpm exec tsx --env-file=.env.local scripts/vendor-figures.ts --user <uuid> --apply
//
//   --user <uuid>      REQUIRED. Whose exercises to re-media.
//   --apply            Perform the file copies + DB updates.
//   --refresh          Re-download the package even if cached.
//   --min-score <0..1> Fuzzy-match threshold (default 0.65).
//   --keep-photos      Leave the old .jpg files on disk (default: report them
//                      as orphaned; they are only deleted with --prune).
//   --prune            Delete photo files that no row references any more.

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { createSupabaseAdminClient } from "../supabase/seed/lib/supabase-admin";
import {
  buildIndex,
  findDanglingAliases,
  findMatch,
} from "../src/lib/catalog/name-match";

const execFileAsync = promisify(execFile);

const PACKAGE_SPEC = "@bryllim/workout-guide@1.0.0";
const REPO_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(REPO_ROOT, "scripts", ".cache");
const PACKAGE_DIR = path.join(CACHE_DIR, "workout-guide");
const MEDIA_DIR = path.join(REPO_ROOT, "public", "exercises");
const FIGURE_DIR = path.join(MEDIA_DIR, "figures");
/** Web path prefix — must mirror FIGURE_DIR under public/. */
const FIGURE_WEB_PREFIX = "/exercises/figures";
const FRAME_COUNT = 3;
const MEDIA_TYPE = "figure-sequence";

// Hand-curated pairings for lifts the fuzzy matcher cannot reach on word
// overlap. Each one was read off the dry-run's unmatched/near-miss table and
// confirmed by eye against the catalog name. The alias is consulted BEFORE
// scoring, so this table never has to fight the threshold — which is the
// point: loosening the threshold to catch these would let the false positives
// back in (see scripts/verify-name-match.ts).
//
// KEY = Marcus's exercise name (normalized), VALUE = catalog name.
const ALIASES: Record<string, string> = {
  // Shorthand and house names the catalog spells differently.
  "military press": "Overhead Press",
  "jm press": "Skull Crusher",
  "meadows row": "Meadows Row",
  "bayesian curl": "Cable Curl",
  "cable straight bar curl": "Cable Curl",
  "seated overhead bb press": "Overhead Press",
  "seated machine press": "Machine Shoulder Press",
  "seated incline machine press": "Machine Shoulder Press",
  "conventional deadlift": "Deadlift",
  "heel elevated bb back squat": "Squat",
  "cable pushdown": "Tricep Pushdown",
  "single arm cable pushdown": "Tricep Pushdown",
  "overhead cable rope extension": "Overhead Tricep Extension",
  "skull crushers": "Skull Crusher",
  "cable wood chopper": "Cable Woodchop",
  "cable rope face pulls": "Face Pull",
  "cable lat pulldown": "Lat Pulldown",
  "kneeling single arm cable pulldown": "Straight-Arm Pulldown",
  "kneeling single arm cable lat row": "Single-Arm Cable Row",
  "straight arm cable pulldown": "Straight-Arm Pulldown",
  "3 point single arm db row": "One-Arm Dumbbell Row",
  "single arm chest supported row": "Chest Supported Row",
  "seated chest supported row": "Chest Supported Row",
  "high to low cable fly": "Cable Fly",
  "single arm cable rear delt fly": "Cable Rear Delt Fly",
  "single arm cable lateral raise": "Cable Lateral Raise",
  "decline ab crunch": "Crunch",
  "hanging leg raises": "Hanging Leg Raise",
  "seated ab curl machine": "Crunch",
  "rotational abs": "Cable Woodchop",
  "low back extensions": "Back Extension",
  "seated hamstring curl": "Seated Leg Curl",
  "calf raise on leg press": "Leg Press Calf Raise",
  "atg calf raises": "Standing Calf Raise",
  "standing calf raise machine": "Standing Calf Raise",
  "alternating db lunges": "Walking Lunge",
  "atg split squat": "Bulgarian Split Squat",
  "cossack squats": "Cossack Squat",
  "full rom pull ups": "Pull-Up",
  "bodyweight pull ups": "Pull-Up",
  "weighted pull ups": "Weighted Pull-Up",
  "weighted dips": "Weighted Dip",
  "tricep dip machine": "Assisted Dip",
  // The catalog's "Incline Bench Press" IS the barbell version; left to the
  // fuzzy matcher this scored 0.65 onto "Incline Dumbbell Press" instead,
  // i.e. the right movement drawn with the wrong implement.
  "incline bb press": "Incline Bench Press",
  "incline smith": "Incline Bench Press",
  "incline smith machine": "Incline Bench Press",
  "cable pullover": "Straight-Arm Pulldown",
  "machine pullover": "Straight-Arm Pulldown",
  "cable machine pullover": "Straight-Arm Pulldown",
  "sl db rdl": "Single-Leg Romanian Deadlift",
  "bb romanian deadlift": "Romanian Deadlift",
  "db romanian deadlift": "Dumbbell Romanian Deadlift",
  "hip thrust machine": "Hip Thrust",
  "dead hang": "Dead Hang",
  "db t y i raises": "Prone Y Raise",
  "alternating db curls": "Bicep Curl",
  "hammer curls": "Hammer Curl",
  "db preacher curl": "Preacher Curl",
  "seated good mornings": "Good Morning",
  "single leg bb squat": "Bulgarian Split Squat",
  "seated leg extension": "Leg Extension",
  "pec deck": "Pec Deck",
  "reverse pec deck": "Reverse Pec Deck",
  "barbell shrug": "Barbell Shrug",
  "db shrug": "Dumbbell Shrug",
  "t bar row": "T-Bar Row",
  "bent over barbell row": "Barbell Row",
  "leg press": "Leg Press",
  "hack squat": "Hack Squat",
};

// Exercises that will never have a figure and should not be reported as gaps:
// the ad-hoc bank placeholder, a mobility prop with no catalog analogue, and
// an e2e fixture row.
const NOT_A_MOVEMENT = new Set([
  "free choice from bank",
  "dragon staff",
  "test pistol squat t12b",
]);

type Args = {
  userId: string;
  apply: boolean;
  refresh: boolean;
  minScore: number;
  prune: boolean;
};

function parseArgs(argv: string[]): Args {
  let userId = "";
  let apply = false;
  let refresh = false;
  let prune = false;
  let minScore = 0.65;

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

    if (arg === "--min-score") {
      minScore = Number.parseFloat(argv[i + 1] ?? "");
      i++;
      continue;
    }

    if (arg === "--apply") apply = true;
    if (arg === "--refresh") refresh = true;
    if (arg === "--prune") prune = true;
  }

  if (!userId) {
    console.error(
      "Refusing to run without --user <uuid>: every read and write is user-scoped.",
    );
    process.exit(1);
  }

  if (!Number.isFinite(minScore) || minScore <= 0 || minScore > 1) {
    console.error(`--min-score must be in (0, 1]; got ${minScore}`);
    process.exit(1);
  }

  return { userId, apply, refresh, minScore, prune };
}

// --- catalog ------------------------------------------------------------

type FigureEntry = {
  slug: string;
  name: string;
  /** Relative frame paths inside the package, in order. */
  frames: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseManifest(raw: string): FigureEntry[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("manifest.json is not an array");
  }

  const entries: FigureEntry[] = [];

  for (const item of parsed) {
    if (!isRecord(item)) continue;

    const { slug, name, frames } = item;

    if (typeof slug !== "string" || typeof name !== "string") continue;
    if (!Array.isArray(frames)) continue;

    const framePaths = frames
      .filter(isRecord)
      .map((frame) => frame.path)
      .filter((p): p is string => typeof p === "string");

    // A partial sequence would animate wrong; skip rather than half-render.
    if (framePaths.length !== FRAME_COUNT) continue;

    entries.push({ slug, name, frames: framePaths });
  }

  return entries;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download + unpack the package into the cache. `npm pack` is used rather than
 * adding a dependency: these are build-time assets that get vendored into
 * public/, so the package has no business in the app's node_modules or its
 * bundle.
 */
async function loadPackage(refresh: boolean): Promise<FigureEntry[]> {
  const manifestPath = path.join(PACKAGE_DIR, "manifest.json");

  if (!refresh && (await pathExists(manifestPath))) {
    console.log(`  catalog: cached at ${PACKAGE_DIR}`);
    return parseManifest(await fs.readFile(manifestPath, "utf8"));
  }

  console.log(`  catalog: downloading ${PACKAGE_SPEC} …`);
  await fs.rm(PACKAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const { stdout } = await execFileAsync(
    "npm",
    ["pack", PACKAGE_SPEC, "--silent"],
    { cwd: CACHE_DIR },
  );
  const tarball = stdout.trim().split("\n").pop() ?? "";

  if (!tarball) {
    throw new Error("npm pack produced no tarball name");
  }

  await fs.mkdir(PACKAGE_DIR, { recursive: true });
  // --strip-components=1 drops the tarball's "package/" wrapper.
  await execFileAsync("tar", [
    "xzf",
    path.join(CACHE_DIR, tarball),
    "-C",
    PACKAGE_DIR,
    "--strip-components=1",
  ]);
  await fs.rm(path.join(CACHE_DIR, tarball), { force: true });

  console.log(`  catalog: unpacked to ${PACKAGE_DIR}`);
  return parseManifest(await fs.readFile(manifestPath, "utf8"));
}

// --- planning -----------------------------------------------------------

type ExerciseRow = {
  exercise_id: string;
  name: string;
  media_path: string | null;
  media_type: string | null;
  source_slug: string | null;
};

type FigurePlan = {
  row: ExerciseRow;
  entry: FigureEntry;
  score: number;
  how: string;
  webPath: string;
  /** Absolute [source, destination] pairs for the three frames. */
  copies: [string, string][];
};

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(
    `\nvendor-figures — ${args.apply ? "APPLY" : "DRY RUN"} (user ${args.userId})\n`,
  );

  const catalog = await loadPackage(args.refresh);
  console.log(`  catalog: ${catalog.length} exercises\n`);

  const index = buildIndex(catalog);

  // A typo in ALIASES must be loud, not a silent no-match.
  const dangling = findDanglingAliases(index, ALIASES);

  if (dangling.length > 0) {
    console.error(
      `✗ ${dangling.length} alias(es) point at names this catalog does not have:`,
    );
    for (const line of dangling) console.error(`    ${line}`);
    console.error(
      "\n  Fix ALIASES (the catalog name must match exactly) and re-run.",
    );
    process.exit(1);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_id, name, media_path, media_type, source_slug")
    .eq("user_id", args.userId)
    .order("name");

  if (error) {
    console.error(`Failed to read exercises: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as ExerciseRow[];
  console.log(`  library: ${rows.length} exercises\n`);

  const plans: FigurePlan[] = [];
  const unmatched: { row: ExerciseRow; near: string; score: number }[] = [];
  const skipped: ExerciseRow[] = [];

  for (const row of rows) {
    if (NOT_A_MOVEMENT.has(row.name.trim().toLowerCase())) {
      skipped.push(row);
      continue;
    }

    const match = findMatch(row.name, index, args.minScore, ALIASES);

    if (!match || match.how === "none") {
      unmatched.push({
        row,
        near: match?.entry.name ?? "—",
        score: match?.score ?? 0,
      });
      continue;
    }

    const webPath = `${FIGURE_WEB_PREFIX}/${match.entry.slug}`;
    const copies = match.entry.frames.map(
      (frame, i): [string, string] => [
        path.join(PACKAGE_DIR, frame),
        path.join(FIGURE_DIR, match.entry.slug, `frame-${i + 1}.png`),
      ],
    );

    plans.push({ row, entry: match.entry, score: match.score, how: match.how, webPath, copies }); // prettier-ignore
  }

  // --- the dry-run table -------------------------------------------------
  console.log(
    `MATCHED (${plans.length})  ${pad("exercise", 34)} ${pad("figure", 30)} score  how`,
  );
  console.log("-".repeat(88));

  for (const plan of [...plans].sort((a, b) => a.score - b.score)) {
    const flag = plan.score < 0.75 && plan.how === "fuzzy" ? "⚑" : " ";
    console.log(
      `  ${flag} ${pad(plan.row.name, 34)} ${pad(plan.entry.name, 30)} ${plan.score.toFixed(2)}  ${plan.how}`,
    );
  }

  if (unmatched.length > 0) {
    console.log(`\nUNMATCHED (${unmatched.length}) — these keep whatever media they have`); // prettier-ignore
    console.log("-".repeat(88));
    for (const item of unmatched) {
      console.log(
        `    ${pad(item.row.name, 34)} nearest: ${pad(item.near, 30)} ${item.score.toFixed(2)}`,
      );
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSKIPPED (${skipped.length}) — not a movement`);
    for (const row of skipped) console.log(`    ${row.name}`);
  }

  // Photos that no longer back any row once the figures land.
  const keepingPhoto = new Set(
    rows
      .filter(
        (row) =>
          row.media_type === "image" &&
          row.media_path &&
          !plans.some((plan) => plan.row.exercise_id === row.exercise_id),
      )
      .map((row) => path.basename(row.media_path as string)),
  );
  const photoFiles = (await pathExists(MEDIA_DIR))
    ? (await fs.readdir(MEDIA_DIR)).filter((f) => f.endsWith(".jpg"))
    : [];
  const orphanedPhotos = photoFiles.filter((f) => !keepingPhoto.has(f));

  console.log(
    `\nPHOTOS: ${photoFiles.length} on disk · ${keepingPhoto.size} still referenced · ${orphanedPhotos.length} orphaned`,
  );

  if (!args.apply) {
    console.log(
      `\nDRY RUN — nothing written. ${plans.length} row(s) would get a figure` +
        `, ${plans.length * FRAME_COUNT} frame(s) copied` +
        (args.prune ? `, ${orphanedPhotos.length} photo(s) deleted` : "") +
        ".\n  Re-run with --apply to write.\n",
    );
    return;
  }

  // --- apply -------------------------------------------------------------
  console.log(`\nAPPLYING …`);

  await fs.mkdir(FIGURE_DIR, { recursive: true });

  // The licence travels WITH the artwork. Anyone who finds these files must be
  // able to see what they are and what the terms are without reading this
  // script or the app's source.
  for (const file of ["LICENSES.md", "LICENSE", "LICENSE-ASSETS", "ATTRIBUTION.md"]) { // prettier-ignore
    const from = path.join(PACKAGE_DIR, file);
    if (await pathExists(from)) {
      await fs.copyFile(from, path.join(FIGURE_DIR, file));
    }
  }

  let copied = 0;

  for (const plan of plans) {
    await fs.mkdir(path.join(FIGURE_DIR, plan.entry.slug), { recursive: true });

    for (const [from, to] of plan.copies) {
      // copyFile, never a transform: the artwork ships byte-identical (D35).
      await fs.copyFile(from, to);
      copied++;
    }

    const { error: updateError } = await supabase
      .from("exercises")
      .update({
        media_path: plan.webPath,
        media_type: MEDIA_TYPE,
        source_slug: plan.entry.slug,
      })
      .eq("exercise_id", plan.row.exercise_id)
      .eq("user_id", args.userId);

    if (updateError) {
      console.error(`  ✗ ${plan.row.name}: ${updateError.message}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`  ✓ ${pad(plan.row.name, 34)} → ${plan.webPath}`);
  }

  if (args.prune) {
    for (const file of orphanedPhotos) {
      await fs.rm(path.join(MEDIA_DIR, file), { force: true });
    }
    console.log(`  pruned ${orphanedPhotos.length} orphaned photo(s)`);
  }

  console.log(
    `\nDone. ${plans.length} row(s) updated, ${copied} frame(s) vendored.\n`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
