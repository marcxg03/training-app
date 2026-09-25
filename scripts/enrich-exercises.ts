// Enrich Marcus's EXISTING exercises from the free-exercise-db catalog (T2-A).
//
// D26: the catalog is `yuhonas/free-exercise-db` — public domain (Unlicense),
// media included, and it carries `mechanic` (compound/isolation). It is the
// clean-license choice precisely because the roadmap is a PAID community where
// followers load Marcus's programs, i.e. commercial redistribution.
//
// D27: media is PLUGGABLE and SAME-ORIGIN. Images are vendored into
// `public/exercises/<source_slug>.jpg` and the row stores the app-relative path
// — the CSP blocks external hosts, so no CDN and no Storage URL. Swapping in
// one of Marcus's own filmed clips later is: drop the file in, update the row's
// media_path/media_type. No schema or code change.
//
// WHAT THIS DOES **NOT** DO: it does not import the catalog. Only exercises
// Marcus ALREADY has are enriched; 800-odd unused rows are not his library.
//
// SAFETY
//   - DRY-RUN BY DEFAULT. No DB write and no file write without --apply.
//   - Every read and write is scoped to --user; omit it and the script refuses.
//   - The catalog is cached once under scripts/.cache/ (gitignored), so repeat
//     runs are offline. --refresh-catalog forces a re-download.
//   - D28 WINS over the catalog's `mechanic` on any conflict, and every
//     conflict is printed. (The catalog is not trustworthy here: it labels
//     "3/4 Sit-Up" a compound.)
//
// USAGE
//   # 1. preview matches, conflicts, and the media download size:
//   pnpm exec tsx --env-file=.env.local scripts/enrich-exercises.ts --user <uuid>
//   # 2. write rows + vendor the images:
//   pnpm exec tsx --env-file=.env.local scripts/enrich-exercises.ts --user <uuid> --apply
//
//   --user <uuid>       REQUIRED. Whose exercises to enrich.
//   --apply             Perform DB updates + image downloads.
//   --dry-run           Explicit default.
//   --refresh-catalog   Re-download the catalog even if cached.
//   --min-score <0..1>  Fuzzy-match threshold (default 0.6).

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { createSupabaseAdminClient } from "../supabase/seed/lib/supabase-admin";
import {
  explainCompoundClassification,
  normalizeExerciseName,
} from "../src/lib/methodology/compound-classification";
import { buildIndex, findMatch } from "../src/lib/catalog/name-match";

const CATALOG_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const REPO_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(REPO_ROOT, "scripts", ".cache");
const CATALOG_CACHE = path.join(CACHE_DIR, "free-exercise-db.json");
const MEDIA_DIR = path.join(REPO_ROOT, "public", "exercises");
// Fuzzy matches at or above this score are confident; below it they are shown
// with a ⚑ so the weak ones get eyeballed before --apply.
const REVIEW_SCORE = 0.75;

type Args = {
  userId: string;
  apply: boolean;
  refreshCatalog: boolean;
  minScore: number;
};

function parseArgs(argv: string[]): Args {
  let userId = "";
  let apply = false;
  let refreshCatalog = false;
  let minScore = 0.6;

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

    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      apply = false;
      continue;
    }

    if (arg === "--refresh-catalog") {
      refreshCatalog = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (userId.trim().length === 0) {
    throw new Error(
      "--user <uuid> is REQUIRED. This script never writes globally; it must be scoped to one user.",
    );
  }

  if (!Number.isFinite(minScore) || minScore <= 0 || minScore > 1) {
    throw new Error("--min-score must be a number in (0, 1].");
  }

  return { userId: userId.trim(), apply, refreshCatalog, minScore };
}

// --- catalog ------------------------------------------------------------

type CatalogEntry = {
  id: string;
  name: string;
  mechanic: string | null;
  images: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCatalog(raw: string): CatalogEntry[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Catalog is not a JSON array.");
  }

  return parsed.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string"
    ) {
      return [];
    }

    const images = Array.isArray(entry.images)
      ? entry.images.filter((img): img is string => typeof img === "string")
      : [];

    return [
      {
        id: entry.id,
        name: entry.name,
        mechanic: typeof entry.mechanic === "string" ? entry.mechanic : null,
        images,
      },
    ];
  });
}

async function loadCatalog(refresh: boolean): Promise<CatalogEntry[]> {
  if (!refresh) {
    try {
      const cached = await fs.readFile(CATALOG_CACHE, "utf8");
      console.log(`  catalog: cache hit (${CATALOG_CACHE})`);
      return parseCatalog(cached);
    } catch {
      // fall through to network
    }
  }

  console.log(`  catalog: fetching ${CATALOG_URL}`);
  const response = await fetch(CATALOG_URL);

  if (!response.ok) {
    throw new Error(
      `Catalog fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const raw = await response.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CATALOG_CACHE, raw, "utf8");
  console.log(`  catalog: cached to ${CATALOG_CACHE}`);

  return parseCatalog(raw);
}

// --- matching -----------------------------------------------------------
//
// EXTRACTED IN T2-F to src/lib/catalog/name-match.ts so the figure catalog
// (scripts/vendor-figures.ts) matches by exactly the same rules. The guards
// that live there — the head-noun gate, the IDF weighting, the singular
// stemmer — were all hardened against false positives found in THIS script's
// dry-runs; scripts/verify-name-match.ts pins each one.

// --- media --------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function headContentLength(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: "HEAD" });

    if (!response.ok) {
      return 0;
    }

    return Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  } catch {
    return 0;
  }
}

async function downloadImage(url: string, destination: string): Promise<number> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Image fetch failed (${response.status}) for ${url}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);

  return bytes.byteLength;
}

// --- main ---------------------------------------------------------------

type ExerciseRow = {
  exercise_id: string;
  name: string;
  is_compound: boolean;
  media_path: string | null;
  media_type: string | null;
  source_slug: string | null;
};

type Plan = {
  row: ExerciseRow;
  entry: CatalogEntry;
  score: number;
  // "alias" is reachable only when a caller passes an alias table; this
  // script does not, but the shared matcher's type includes it (T2-F).
  how: "exact" | "alias" | "fuzzy";
  sourceSlug: string;
  d28Compound: boolean;
  d28Rule: string;
  catalogMechanic: string | null;
  conflict: boolean;
  imageUrl: string | null;
  mediaPath: string | null;
  destination: string | null;
  alreadyOnDisk: boolean;
  dbChanges: boolean;
};

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
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

async function main(): Promise<void> {
  const { userId, apply, refreshCatalog, minScore } = parseArgs(
    process.argv.slice(2),
  );

  console.log("════════════════════════════════════════════════════════");
  console.log("  enrich-exercises · free-exercise-db (D26/D27/D28)");
  console.log(`  user:  ${userId}`);
  console.log(`  mode:  ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("════════════════════════════════════════════════════════");

  const catalog = await loadCatalog(refreshCatalog);
  console.log(`  catalog: ${catalog.length} exercises`);

  const index = buildIndex(catalog);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("exercise_id, name, is_compound, media_path, media_type, source_slug")
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

  console.log(`  library: ${rows.length} exercises\n`);

  const plans: Plan[] = [];
  const unmatched: { row: ExerciseRow; nearest: string; score: number }[] = [];

  for (const row of rows) {
    const match = findMatch(row.name, index, minScore);
    const { isCompound, rule } = explainCompoundClassification(row.name);

    if (match === null || match.how === "none") {
      unmatched.push({
        row,
        nearest: match?.entry.name ?? "—",
        score: match?.score ?? 0,
      });
      continue;
    }

    const sourceSlug = match.entry.id;
    const firstImage = match.entry.images[0] ?? null;
    const mediaPath = firstImage ? `/exercises/${sourceSlug}.jpg` : null;
    const destination = firstImage
      ? path.join(MEDIA_DIR, `${sourceSlug}.jpg`)
      : null;

    plans.push({
      row,
      entry: match.entry,
      score: match.score,
      how: match.how,
      sourceSlug,
      d28Compound: isCompound,
      d28Rule: rule,
      catalogMechanic: match.entry.mechanic,
      // The catalog only conflicts when it actually states a mechanic.
      conflict:
        match.entry.mechanic !== null &&
        (match.entry.mechanic === "compound") !== isCompound,
      imageUrl: firstImage ? `${IMAGE_BASE_URL}${firstImage}` : null,
      mediaPath,
      destination,
      alreadyOnDisk: destination ? await fileExists(destination) : false,
      dbChanges:
        row.source_slug !== sourceSlug ||
        row.is_compound !== isCompound ||
        row.media_path !== mediaPath ||
        row.media_type !== (mediaPath ? "image" : null),
    });
  }

  // --- matched table ---
  const nameWidth = Math.min(
    32,
    Math.max(12, ...plans.map((p) => p.row.name.length)),
  );
  console.log(
    `  ${pad("EXERCISE", nameWidth)}  ${pad("CATALOG MATCH", 34)}  ${pad("HOW", 6)}  ${pad("SCORE", 6)}  CMPD`,
  );
  console.log(`  ${"─".repeat(nameWidth + 58)}`);

  for (const plan of plans) {
    // Anything under REVIEW_SCORE matched, but weakly — the media it pulls in
    // is the most likely thing to be visibly wrong. Marked so Marcus's eye
    // lands on those rows instead of reading 60 lines evenly.
    const flags = [
      plan.score < REVIEW_SCORE ? "⚑ review" : "",
      plan.conflict ? "⚠ catalog disagrees" : "",
    ]
      .filter((flag) => flag.length > 0)
      .join("  ");

    console.log(
      `  ${pad(plan.row.name, nameWidth)}  ${pad(plan.entry.name, 34)}  ${pad(plan.how, 6)}  ${pad(plan.score.toFixed(2), 6)}  ${pad(plan.d28Compound ? "yes" : "no", 4)}  ${flags}`,
    );
  }

  // --- conflicts (D28 wins) ---
  const conflicts = plans.filter((plan) => plan.conflict);

  if (conflicts.length > 0) {
    console.log("");
    console.log(
      `  ⚠ ${conflicts.length} mechanic conflict(s) — D28 WINS, catalog value discarded:`,
    );
    for (const plan of conflicts) {
      console.log(
        `    ${plan.row.name}: catalog says "${plan.catalogMechanic}", D28 says ${plan.d28Compound ? "compound" : "isolation"} (${plan.d28Rule})`,
      );
    }
  }

  // --- unmatched (eyeball list) ---
  if (unmatched.length > 0) {
    console.log("");
    console.log(
      `  ${unmatched.length} unmatched (no media proposed; is_compound still set by classify-compounds):`,
    );
    for (const miss of unmatched) {
      console.log(
        `    ${pad(miss.row.name, nameWidth)}  nearest: ${miss.nearest} (${miss.score.toFixed(2)})`,
      );
    }
  }

  // --- media accounting ---
  const toDownload = plans.filter(
    (plan) => plan.destination !== null && !plan.alreadyOnDisk,
  );
  const skipped = plans.filter((plan) => plan.alreadyOnDisk);
  const noImage = plans.filter((plan) => plan.destination === null);

  console.log("");
  console.log(`  matched                ${plans.length}`);
  console.log(`  ⚑ low-confidence       ${plans.filter((p) => p.score < REVIEW_SCORE).length}`); // prettier-ignore
  console.log(`  unmatched              ${unmatched.length}`);
  console.log(`  db rows to update      ${plans.filter((p) => p.dbChanges).length}`); // prettier-ignore
  console.log(`  images to download     ${toDownload.length}`);
  console.log(`  images already vendored ${skipped.length}`);
  console.log(`  matches with no image  ${noImage.length}`);

  if (!apply) {
    // HEAD-only size preview: read-only, writes nothing, but tells Marcus
    // exactly what --apply would pull into the repo.
    let previewBytes = 0;
    for (const plan of toDownload) {
      previewBytes += await headContentLength(plan.imageUrl as string);
    }
    console.log(`  total bytes (preview)  ${formatBytes(previewBytes)}`);
    console.log("");
    console.log(
      "  DRY-RUN — no DB write, no file written. Re-run with --apply when the table looks right.",
    );
    return;
  }

  // --- apply: vendor the media first, then point rows at it ---
  let totalBytes = 0;
  console.log("");

  for (const plan of toDownload) {
    const bytes = await downloadImage(
      plan.imageUrl as string,
      plan.destination as string,
    );
    totalBytes += bytes;
    console.log(
      `  ↓ ${plan.sourceSlug}.jpg  ${formatBytes(bytes)}  (${plan.row.name})`,
    );
  }

  console.log(`  total bytes downloaded ${formatBytes(totalBytes)}`);
  console.log("");

  let written = 0;

  for (const plan of plans) {
    if (!plan.dbChanges) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("exercises")
      .update({
        source_slug: plan.sourceSlug,
        // D28 is the authority; the catalog's mechanic is only a cross-check.
        is_compound: plan.d28Compound,
        media_path: plan.mediaPath,
        media_type: plan.mediaPath ? "image" : null,
      })
      .eq("exercise_id", plan.row.exercise_id)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(
        `Failed to update "${plan.row.name}": ${updateError.message}`,
      );
    }

    written++;
    console.log(`  ✓ ${plan.row.name} → ${plan.sourceSlug}`);
  }

  console.log("");
  console.log(
    `  APPLIED — ${written} row(s) updated, ${toDownload.length} image(s) vendored (${formatBytes(totalBytes)}).`,
  );
}

main().catch((error: unknown) => {
  console.error(`\nenrich-exercises failed: ${(error as Error).message}`);
  process.exit(1);
});
