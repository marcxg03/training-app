// Compound vs isolation classification, by exercise NAME (D28).
//
// Why a name matcher: `exercises.is_compound` has existed since migration 002
// and `buildE1rmSpotlights` already excludes non-compound + bodyweight lifts —
// the code gate is correct. What is wrong is the DATA: every row sits on the
// column's `false` DEFAULT, so estimated-1RM reads wrong to the user. This
// module is the single place that decides which names are compounds, so the
// backfill (scripts/classify-compounds.ts), the catalog enrichment
// (scripts/enrich-exercises.ts) and the future desktop builder all agree, and
// so the decision is unit-testable without a database
// (scripts/verify-compound-classification.ts).
//
// D28 (locked by Marcus 2026-09-23) — these get estimated-1RM + the weight-PR
// trend: Bench Press · Incline Press · Overhead/Shoulder Press · Back Squat ·
// Deadlift (RDL/Sumo/conventional) · Barbell/DB/Chest-Supported Row ·
// Weighted Dips · Weighted Pull-up/Chin · Lat Pulldown. Everything else
// (lateral raise, rear delt, biceps, triceps, chest fly, face pull, calf
// raise, walking lunges, single-arm cables, core) is isolation.
//
// The rule order matters: ISOLATION patterns are evaluated FIRST, so an
// isolation whose name merely contains a compound word ("Pallof Press",
// "Decline Bench Curl", "Straight Arm Pulldown", "Upright Row", "Triceps Dip")
// can never leak an e1RM chart. Anything that matches no compound pattern is
// isolation — "everything else = false" is the D28 default, not an oversight.
//
// This is pure string logic: no React, no Supabase, no I/O.

export type CompoundClassification = {
  isCompound: boolean;
  /** Human-readable name of the rule that decided it — for dry-run tables. */
  rule: string;
};

type Rule = {
  label: string;
  pattern: RegExp;
};

/**
 * Lowercase, punctuation → space, whitespace collapsed. "Lat Pulldown
 * (Neutral)" → "lat pulldown neutral"; "Pull-Up" → "pull up"; "Back/Glute
 * Extension" → "back glute extension". Every pattern below is written against
 * this shape, so word boundaries are reliable.
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// --- ISOLATION (deny list — evaluated first) ---------------------------
const ISOLATION_RULES: Rule[] = [
  // Arms
  { label: "isolation: curl (biceps/hamstring/mobility)", pattern: /\bcurls?\b/ }, // prettier-ignore
  { label: "isolation: triceps", pattern: /\btriceps?\b/ },
  { label: "isolation: pushdown", pattern: /\bpush ?downs?\b/ },
  { label: "isolation: skullcrusher", pattern: /\bskull ?crushers?\b/ },
  { label: "isolation: kickback", pattern: /\bkick ?backs?\b/ },
  { label: "isolation: bench dip (triceps)", pattern: /\bbench dips?\b/ },
  // Delts
  {
    label: "isolation: lateral raise",
    pattern: /\b(lateral|side)\s+raises?\b/,
  },
  { label: "isolation: lat raise", pattern: /\blat raises?\b/ },
  { label: "isolation: rear delt", pattern: /\brear delts?\b/ },
  { label: "isolation: pec deck / reverse fly", pattern: /\b(pec deck|reverse fly|reverse flyes|reverse flies)\b/ }, // prettier-ignore
  { label: "isolation: face pull", pattern: /\bface pulls?\b/ },
  { label: "isolation: upright row", pattern: /\bupright rows?\b/ },
  { label: "isolation: shrug", pattern: /\bshrugs?\b/ },
  // Chest / back single-joint
  { label: "isolation: fly", pattern: /\bfl(y|ys|ies|yes)\b/ },
  { label: "isolation: cable crossover", pattern: /\bcross ?overs?\b/ },
  { label: "isolation: straight-arm pulldown", pattern: /\bstraight arm\b/ },
  // Legs — accessory, unilateral, machine
  { label: "isolation: calf", pattern: /\b(calf|calves)\b/ },
  { label: "isolation: lunge", pattern: /\blunges?\b/ },
  {
    label: "isolation: extension (leg/back/glute)",
    pattern: /\bextensions?\b/,
  },
  { label: "isolation: hyperextension", pattern: /\bhyper ?extensions?\b/ },
  { label: "isolation: glute-ham raise", pattern: /\bglute ham\b/ },
  // NOTE: no blanket "single leg" deny — Marcus flipped single-leg SQUAT to
  // compound (2026-09-23). Unilateral isolation still denies via its own rule
  // (single-leg calf raise → calf, single-leg curl → curl, etc.).
  { label: "isolation: split squat", pattern: /\bsplit squats?\b/ },
  { label: "isolation: bulgarian split squat", pattern: /\bbulgarian\b/ },
  { label: "isolation: leg press (not in D28)", pattern: /\bleg press\b/ },
  // Core
  { label: "isolation: crunch", pattern: /\bcrunch(es)?\b/ },
  { label: "isolation: plank", pattern: /\bplanks?\b/ },
  { label: "isolation: sit-up", pattern: /\bsit ?ups?\b/ },
  { label: "isolation: leg raise", pattern: /\bleg raises?\b/ },
  { label: "isolation: wood chopper", pattern: /\b(wood ?)?choppers?\b/ },
  { label: "isolation: pallof press", pattern: /\bpallof\b/ },
  { label: "isolation: l-sit", pattern: /\bl sits?\b/ },
  { label: "isolation: hollow hold", pattern: /\bhollow\b/ },
  { label: "isolation: russian twist", pattern: /\brussian twists?\b/ },
  { label: "isolation: ab wheel", pattern: /\bab wheel\b/ },
  { label: "isolation: dragon flag", pattern: /\bdragon\b/ },
  // Mobility / prehab / ATG circuit — never an e1RM surface
  { label: "isolation: ATG circuit", pattern: /\batg\b/ },
  { label: "isolation: dead hang", pattern: /\bdead hangs?\b/ },
  { label: "isolation: jefferson curl", pattern: /\bjefferson\b/ },
  { label: "isolation: external rotation", pattern: /\bexternal rotation\b/ },
  { label: "isolation: TYI raise", pattern: /\btyi\b/ },
];

// --- COMPOUND (allow list — the literal D28 list, generous on variants) --
const COMPOUND_RULES: Rule[] = [
  // Bench Press
  { label: "compound: bench press", pattern: /\bbench press\b/ },
  { label: "compound: chest press", pattern: /\bchest press\b/ },
  { label: "compound: flat press", pattern: /\bflat\b.*\bpress\b/ },
  // Incline Press (and the decline bench variant of the same lift).
  // Broadened to bare "incline" so machine/Smith variants that omit the word
  // "press" ("Incline Smith", "Incline Smith Machine") still classify —
  // the deny list runs FIRST, so "Incline DB Curl" / "Incline Fly" are safe.
  { label: "compound: incline (press variants)", pattern: /\bincline\b/ },
  { label: "compound: incline press", pattern: /\bincline\b.*\bpress\b/ },
  // Smith-machine work in this plan is press/squat loading.
  { label: "compound: smith machine", pattern: /\bsmith\b/ },
  // Machine press variants that omit chest/shoulder ("Seated Machine Press").
  { label: "compound: machine press", pattern: /\bmachine press\b/ },
  // Loaded squat-pattern machine.
  { label: "compound: hack squat", pattern: /\bhack squats?\b/ },
  // Bodyweight compound pull+press (is_bodyweight gates e1RM separately).
  { label: "compound: muscle-up", pattern: /\bmuscle ?ups?\b/ },
  { label: "compound: decline press", pattern: /\bdecline\b.*\bpress\b/ },
  { label: "compound: smith press", pattern: /\bsmith press\b/ },
  // Overhead / Shoulder Press
  { label: "compound: overhead/shoulder press", pattern: /\b(overhead|shoulder|military)\b.*\bpress\b/ }, // prettier-ignore
  { label: "compound: OHP", pattern: /\bohp\b/ },
  { label: "compound: dumbbell press", pattern: /\b(db|dumbbells?)\s+press\b/ },
  // Back Squat
  { label: "compound: back/front squat", pattern: /\b(back|front) squats?\b/ },
  { label: "compound: barbell squat", pattern: /\b(bb|barbell) squats?\b/ },
  // Marcus flipped these three to compound 2026-09-23 (they were isolation
  // under the first reading of D28). Split squat / Bulgarian stay isolation.
  { label: "compound: single-leg squat", pattern: /\bsingle leg\b.*\bsquats?\b/ }, // prettier-ignore
  { label: "compound: good morning", pattern: /\bgood mornings?\b/ },
  { label: "compound: pullover", pattern: /\bpull ?overs?\b/ },
  // Deadlift — RDL / sumo / conventional
  { label: "compound: deadlift", pattern: /\bdead ?lifts?\b/ },
  { label: "compound: RDL", pattern: /\brdls?\b/ },
  // Barbell / DB / chest-supported row
  { label: "compound: row", pattern: /\brows?\b/ },
  // Weighted dips
  { label: "compound: dip", pattern: /\bdips?\b/ },
  // Weighted pull-up / chin-up
  { label: "compound: pull-up/chin-up", pattern: /\b(pull|chin) ?ups?\b/ },
  // Lat pulldown
  { label: "compound: lat pulldown", pattern: /\bpull ?downs?\b/ },
];

/**
 * Which rule decided this name, and what it decided. Isolation rules win ties
 * by being evaluated first. Used by the dry-run tables so Marcus can eyeball
 * WHY a lift was classified the way it was before anything is written.
 */
export function explainCompoundClassification(
  name: string,
): CompoundClassification {
  const normalized = normalizeExerciseName(name);

  if (normalized.length === 0) {
    return { isCompound: false, rule: "default (no compound pattern matched)" };
  }

  for (const rule of ISOLATION_RULES) {
    if (rule.pattern.test(normalized)) {
      return { isCompound: false, rule: rule.label };
    }
  }

  for (const rule of COMPOUND_RULES) {
    if (rule.pattern.test(normalized)) {
      return { isCompound: true, rule: rule.label };
    }
  }

  return { isCompound: false, rule: "default (no compound pattern matched)" };
}

/**
 * D28 in one call: does this exercise name earn an estimated-1RM surface?
 * Everything not on the compound list is isolation.
 */
export function isCompoundExerciseName(name: string): boolean {
  return explainCompoundClassification(name).isCompound;
}
