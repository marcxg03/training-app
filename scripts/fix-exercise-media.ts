// Re-point three exercises whose T2-A fuzzy match pulled a close-but-WRONG
// catalog image, and vendor the correct art (T2-B, Marcus's validation pass).
//
// The matcher in scripts/enrich-exercises.ts scores on token overlap, so a
// variant name beat the plain movement three times: the flat bench landed on
// the DECLINE bench, the two-arm lat pulldown on the ONE-ARM version, and the
// triceps pushdown on the INCLINE pushdown. Nothing is wrong with the matcher
// as a bulk tool; these are the hand corrections it cannot make.
//
// This is a CORRECTION script, not a re-run of enrichment. It touches exactly
// the exercises named in FIXES below, and only their media columns — is_compound,
// source_slug, and every other row stay as they are.
//
// SAFETY
//   - DRY-RUN BY DEFAULT. No DB write and no file write without --apply.
//   - --user <uuid> is REQUIRED; the script never writes globally.
//   - IDEMPOTENT: a second --apply run finds every row already correct and
//     every image already on disk, and writes nothing.
//   - The old images are left in public/exercises/ — they are still referenced
//     by the exercises they legitimately belong to (Decline Barbell Bench
//     Press etc. are real catalog entries), so deleting them here would be a
//     guess. Pruning genuinely-orphaned art is a separate, auditable job.
//
// USAGE
//   # 1. preview (no writes):
//   pnpm exec tsx --env-file=.env.local scripts/fix-exercise-media.ts --user <uuid>
//   # 2. apply:
//   pnpm exec tsx --env-file=.env.local scripts/fix-exercise-media.ts --user <uuid> --apply

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createSupabaseAdminClient } from "../supabase/seed/lib/supabase-admin";

const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_CACHE = path.join(
  REPO_ROOT,
  "scripts",
  ".cache",
  "free-exercise-db.json",
);
const MEDIA_DIR = path.join(REPO_ROOT, "public", "exercises");

type Fix = {
  /** The exercise name in Marcus's library (matched case-insensitively). */
  exerciseName: string;
  /** What it is pointing at today — printed so a silent re-point is visible. */
  wrongSlug: string;
  /** The catalog entry it should point at. */
  correctSlug: string;
  why: string;
};

const FIXES: Fix[] = [
  {
    exerciseName: "Barbell Bench Press",
    wrongSlug: "Decline_Barbell_Bench_Press",
    correctSlug: "Barbell_Bench_Press_-_Medium_Grip",
    why: "flat bench, not decline",
  },
  {
    exerciseName: "Cable Lat Pulldown",
    wrongSlug: "One_Arm_Lat_Pulldown",
    correctSlug: "Wide-Grip_Lat_Pulldown",
    why: "standard two-arm pulldown, not the one-arm variant",
  },
  {
    exerciseName: "Cable Pushdown",
    wrongSlug: "Cable_Incline_Pushdown",
    correctSlug: "Triceps_Pushdown",
    why: "standard triceps pushdown, not the incline variant",
  },
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type CatalogEntry = {
  id: string;
  name: string;
  images: string[];
};

/** Read the cache enrich-exercises already wrote. If it is missing, say so
 * rather than silently hitting the network mid-correction. */
async function loadCatalog(): Promise<Map<string, CatalogEntry>> {
  let raw: string;

  try {
    raw = await fs.readFile(CATALOG_CACHE, "utf8");
  } catch {
    throw new Error(
      `Catalog cache not found at ${CATALOG_CACHE}. Run scripts/enrich-exercises.ts once (dry-run is enough) to populate it.`,
    );
  }

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Catalog cache is not a JSON array.");
  }

  const byId = new Map<string, CatalogEntry>();

  for (const entry of parsed) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string"
    ) {
      continue;
    }

    byId.set(entry.id, {
      id: entry.id,
      name: entry.name,
      images: Array.isArray(entry.images)
        ? entry.images.filter((img): img is string => typeof img === "string")
        : [],
    });
  }

  return byId;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url: string, destination: string): Promise<number> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status}) for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);

  return bytes.byteLength;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ExerciseRow = {
  exercise_id: string;
  name: string;
  media_path: string | null;
  media_type: string | null;
};

type Plan = {
  fix: Fix;
  row: ExerciseRow;
  catalogName: string;
  imageUrl: string;
  mediaPath: string;
  destination: string;
  alreadyOnDisk: boolean;
  dbChanges: boolean;
};

async function main(): Promise<void> {
  const { userId, apply } = parseArgs(process.argv.slice(2));

  console.log("════════════════════════════════════════════════════════");
  console.log("  fix-exercise-media · 3 wrong catalog matches (T2-B)");
  console.log(`  user:  ${userId}`);
  console.log(`  mode:  ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("════════════════════════════════════════════════════════");

  const catalog = await loadCatalog();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_id, name, media_path, media_type")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to read exercises: ${error.message}`);
  }

  const rows = (data ?? []) as ExerciseRow[];
  const byName = new Map(
    rows.map((row) => [row.name.trim().toLowerCase(), row] as const),
  );

  const plans: Plan[] = [];
  const missing: Fix[] = [];

  for (const fix of FIXES) {
    const row = byName.get(fix.exerciseName.trim().toLowerCase());

    if (!row) {
      missing.push(fix);
      continue;
    }

    const entry = catalog.get(fix.correctSlug);

    if (!entry) {
      throw new Error(
        `Catalog has no entry "${fix.correctSlug}" (for ${fix.exerciseName}). Refresh the cache via enrich-exercises.ts --refresh-catalog.`,
      );
    }

    const firstImage = entry.images[0];

    if (!firstImage) {
      throw new Error(
        `Catalog entry "${fix.correctSlug}" carries no image; pick another entry for ${fix.exerciseName}.`,
      );
    }

    const mediaPath = `/exercises/${fix.correctSlug}.jpg`;
    const destination = path.join(MEDIA_DIR, `${fix.correctSlug}.jpg`);

    plans.push({
      fix,
      row,
      catalogName: entry.name,
      imageUrl: `${IMAGE_BASE_URL}${firstImage}`,
      mediaPath,
      destination,
      alreadyOnDisk: await fileExists(destination),
      dbChanges: row.media_path !== mediaPath || row.media_type !== "image",
    });
  }

  console.log("");

  for (const plan of plans) {
    const status = plan.dbChanges ? "→ RE-POINT" : "✓ already correct";
    // If the row is neither the known-wrong value nor the target, something
    // else has edited it since T2-A — say so instead of overwriting quietly.
    const unexpected =
      plan.dbChanges && plan.row.media_path !== `/exercises/${plan.fix.wrongSlug}.jpg`;

    console.log(`  ${plan.fix.exerciseName}`);
    console.log(`      now:    ${plan.row.media_path ?? "(none)"}`);
    if (unexpected) {
      console.log(
        `      ⚠ expected the known-wrong /exercises/${plan.fix.wrongSlug}.jpg — this row was changed elsewhere`,
      );
    }
    console.log(`      should: ${plan.mediaPath}  (${plan.catalogName})`);
    console.log(`      why:    ${plan.fix.why}`);
    console.log(
      `      ${status}${plan.alreadyOnDisk ? " · image already vendored" : " · image to download"}`,
    );
    console.log("");
  }

  if (missing.length > 0) {
    console.log(
      `  ⚠ ${missing.length} exercise(s) not found in this user's library — NOT created:`,
    );
    for (const fix of missing) {
      console.log(`    ${fix.exerciseName}`);
    }
    console.log("");
  }

  const toDownload = plans.filter((plan) => !plan.alreadyOnDisk);
  const toWrite = plans.filter((plan) => plan.dbChanges);

  console.log(`  rows to update       ${toWrite.length}`);
  console.log(`  images to download   ${toDownload.length}`);

  if (!apply) {
    console.log("");
    console.log(
      "  DRY-RUN — no DB write, no file written. Re-run with --apply when the table looks right.",
    );
    return;
  }

  // Vendor the art FIRST: a row pointed at a file that does not exist yet would
  // render a broken image for the length of the download.
  let totalBytes = 0;
  console.log("");

  for (const plan of toDownload) {
    const bytes = await downloadImage(plan.imageUrl, plan.destination);
    totalBytes += bytes;
    console.log(
      `  ↓ ${plan.fix.correctSlug}.jpg  ${formatBytes(bytes)}  (${plan.fix.exerciseName})`,
    );
  }

  let written = 0;

  for (const plan of toWrite) {
    const { error: updateError } = await supabase
      .from("exercises")
      .update({ media_path: plan.mediaPath, media_type: "image" })
      .eq("exercise_id", plan.row.exercise_id)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(
        `Failed to update "${plan.fix.exerciseName}": ${updateError.message}`,
      );
    }

    written++;
    console.log(`  ✓ ${plan.fix.exerciseName} → ${plan.fix.correctSlug}`);
  }

  console.log("");
  console.log(
    `  APPLIED — ${written} row(s) updated, ${toDownload.length} image(s) vendored (${formatBytes(totalBytes)}).`,
  );
}

main().catch((error: unknown) => {
  console.error(`\nfix-exercise-media failed: ${(error as Error).message}`);
  process.exit(1);
});
