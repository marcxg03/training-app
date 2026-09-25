// Exercise-name matching against an external catalog.
//
// EXTRACTED IN T2-F from scripts/enrich-exercises.ts, where this logic was
// hardened during the T2-A dry-runs. It lives here, generic over the catalog
// shape, because T2-F matches Marcus's library against a SECOND catalog (the
// workout-guide figure set) and two independently-drifting copies of a fuzzy
// matcher is how you end up with two different answers for the same lift.
//
// The scoring is unchanged from the T2-A version — the same stemming, stop
// tokens, head-noun gate and IDF weighting. T2-F DID add three token
// expansions (`sl`, `rom`, `tricep`, marked below) and an optional alias
// table, because the figure catalog's vocabulary reaches lifts the
// free-exercise-db one did not. Those additions can in principle change what
// scripts/enrich-exercises.ts would match on a RE-RUN; that script is
// dry-run-by-default and prints its whole match table, so any change is seen
// before it is written — it is never silent.
//
// scripts/verify-name-match.ts pins the specific false positives each guard
// was added to kill, so a later edit here cannot quietly resurrect them.
//
// Pure string logic: no React, no Supabase, no I/O, no network.

import { normalizeExerciseName } from "@/lib/methodology/compound-classification";

/** The only thing a catalog must expose to be matchable. */
export type NamedEntry = { name: string };

// Marcus's names are gym shorthand ("BB RDL", "SA Cable Kneeling Pulldown");
// catalogs write them out ("Romanian Deadlift"). Expand the shorthand before
// matching or almost nothing lines up.
const TOKEN_EXPANSIONS: Record<string, string[]> = {
  bb: ["barbell"],
  db: ["dumbbell"],
  dbs: ["dumbbell"],
  bw: ["bodyweight"],
  sa: ["single", "arm"],
  ohp: ["overhead", "press"],
  rdl: ["romanian", "deadlift"],
  dl: ["deadlift"],
  wg: ["wide", "grip"],
  cg: ["close", "grip"],
  // T2-F additions. "SL" is Marcus's unilateral prefix ("SL DB RDL"); "ROM"
  // and "ATG" are range-of-motion qualifiers that carry no movement meaning
  // and otherwise drag the head noun off the real lift.
  sl: ["single", "leg"],
  rom: [],
};
// NOTE: "tricep"/"triceps" needs no expansion — the stemmer already folds
// both to "tricep" (see the double-s note on stem()), so the two spellings
// match each other without help.

// Dropped before scoring: grammar words present in one vocabulary and absent
// from the other far more often than they are meaningful.
const STOP_TOKENS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "with",
  "of",
  "for",
]);

// Trailing equipment/qualifier nouns. "Rear Delt Fly Machine" and "Cable Rear
// Delt Fly" are the same movement, so the head noun must be read past these.
const TRAILING_QUALIFIERS = new Set([
  "machine",
  "band",
  "attachment",
  "version",
  "variation",
  "alternative",
  "bar",
  "cable",
  "dumbbell",
  "barbell",
  "bodyweight",
]);

const HEAD_SYNONYMS: Record<string, string> = {
  flye: "fly",
  flie: "fly",
  chin: "pullup",
  chinup: "pullup",
};

/**
 * Crude singular stem — enough to make "Dips"/"Dip", "Lunges"/"Lunge",
 * "Raises"/"Raise", "Flyes"/"Fly" agree.
 *
 * The `ss` guard protects "press" (without it every press in the library
 * becomes "pres" and stops matching every other press). It does NOT protect
 * "triceps", which ends in "ps" — that folds to "tricep". Harmless and in fact
 * useful: catalogs spell it both ways, and folding both spellings to the same
 * token is exactly what makes "Tricep Pushdown" and "Triceps Pushdown" agree.
 *
 * T2-F BUG FIX — the minimum length was `> 3`, which left three-letter plurals
 * alone. "Ups" therefore never became "up", so "Weighted Pull Ups" had head
 * noun "ups" while the catalog's "Pull-Up" had "up": the head gate rejected
 * them as different movements and EVERY pull-up variant in Marcus's library
 * went unmatched. Lowering the bound to `> 2` folds "ups"→"up" and "abs"→"ab"
 * without touching any two-letter token.
 */
export function stem(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("ss")) {
    return token;
  }

  if (
    token.endsWith("es") &&
    token.length > 4 &&
    (token.endsWith("yes") || token.endsWith("ches") || token.endsWith("shes"))
  ) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && token.length > 2) {
    return token.slice(0, -1);
  }

  return token;
}

export function tokenize(name: string): string[] {
  return normalizeExerciseName(name)
    .split(" ")
    .filter((token) => token.length > 0 && !STOP_TOKENS.has(token))
    .flatMap((token) => TOKEN_EXPANSIONS[token] ?? [token])
    .map(stem);
}

export function matchKey(name: string): string {
  return tokenize(name).join(" ");
}

/**
 * The movement noun — the last token that is not an equipment qualifier. Two
 * names may only be matched if these agree. This is the guard that stops
 * "Seated Cable Row" landing on "Cable Seated Crunch" and "SA Cable Kneeling
 * Pulldown" landing on "Single-Arm Cable Crossover": a high word-overlap score
 * alone is not evidence that two exercises are the same movement.
 */
export function headToken(tokens: string[]): string {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];

    if (!TRAILING_QUALIFIERS.has(token)) {
      return HEAD_SYNONYMS[token] ?? token;
    }
  }

  const last = tokens[tokens.length - 1] ?? "";

  return HEAD_SYNONYMS[last] ?? last;
}

/**
 * IDF over the catalog's own names. Plain Dice treats "barbell" and "romanian"
 * as equally informative, which is how "BB Romanian Deadlift" tied onto
 * "Barbell Deadlift" instead of "Romanian Deadlift". Weighting by rarity picks
 * the distinctive word.
 */
export function buildIdf<T extends NamedEntry>(
  catalog: T[],
): (token: string) => number {
  const documentFrequency = new Map<string, number>();

  for (const entry of catalog) {
    for (const token of new Set(tokenize(entry.name))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const total = catalog.length;

  return (token: string) =>
    Math.log((total + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
}

/**
 * IDF-weighted Sørensen–Dice over token SETS. Order-insensitive ("Bent Over BB
 * Row" vs "Barbell Bent Over Row") and length-tolerant. No dependency.
 */
export function weightedDice(
  left: string[],
  right: string[],
  idf: (token: string) => number,
): number {
  const a = new Set(left);
  const b = new Set(right);

  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let overlap = 0;
  let weightA = 0;
  let weightB = 0;

  for (const token of a) {
    weightA += idf(token);

    if (b.has(token)) {
      overlap += idf(token);
    }
  }

  for (const token of b) {
    weightB += idf(token);
  }

  return (2 * overlap) / (weightA + weightB);
}

export type Match<T extends NamedEntry> = {
  entry: T;
  score: number;
  how: "exact" | "alias" | "fuzzy" | "none";
};

export type CatalogIndex<T extends NamedEntry> = {
  entries: { entry: T; tokens: string[]; head: string }[];
  exact: Map<string, T>;
  byName: Map<string, T>;
  idf: (token: string) => number;
};

export function buildIndex<T extends NamedEntry>(
  catalog: T[],
): CatalogIndex<T> {
  const exact = new Map<string, T>();
  const byName = new Map<string, T>();
  const entries = catalog.map((entry) => {
    const tokens = tokenize(entry.name);
    const key = tokens.join(" ");

    if (!exact.has(key)) {
      exact.set(key, entry);
    }

    byName.set(normalizeExerciseName(entry.name), entry);

    return { entry, tokens, head: headToken(tokens) };
  });

  return { entries, exact, byName, idf: buildIdf(catalog) };
}

/**
 * Find the catalog entry for `name`, or the near-miss so a dry-run can show
 * what it almost hit.
 *
 * `aliases` maps one of Marcus's exercise names (normalized) to a catalog name
 * (normalized). It is consulted BEFORE any scoring, so a hand-curated pairing
 * always wins over the fuzzy matcher — that is how T2-F pins the cases the
 * matcher cannot reach on word overlap alone ("Meadows Row", "Bayesian Curl",
 * "JM Press"), without loosening the threshold for everything else.
 */
export function findMatch<T extends NamedEntry>(
  name: string,
  index: CatalogIndex<T>,
  minScore: number,
  aliases?: Record<string, string>,
): Match<T> | null {
  const normalized = normalizeExerciseName(name);
  const aliasTarget = aliases?.[normalized];

  if (aliasTarget !== undefined) {
    // An alias that points at nothing is a typo in the alias table, not a
    // silent no-match — fall through to scoring would hide it.
    const aliased = index.byName.get(normalizeExerciseName(aliasTarget));

    if (aliased) {
      return { entry: aliased, score: 1, how: "alias" };
    }
  }

  const exact = index.exact.get(matchKey(name));

  if (exact) {
    return { entry: exact, score: 1, how: "exact" };
  }

  const tokens = tokenize(name);
  const head = headToken(tokens);
  let best: T | null = null;
  let bestScore = 0;

  for (const candidate of index.entries) {
    if (candidate.head !== head) {
      continue;
    }

    const score = weightedDice(tokens, candidate.tokens, index.idf);

    if (score > bestScore) {
      bestScore = score;
      best = candidate.entry;
    }
  }

  if (best === null) {
    return null;
  }

  if (bestScore >= minScore) {
    return { entry: best, score: bestScore, how: "fuzzy" };
  }

  return { entry: best, score: bestScore, how: "none" };
}

/** Resolve an alias-table target that names no catalog entry — a typo guard. */
export function findDanglingAliases<T extends NamedEntry>(
  index: CatalogIndex<T>,
  aliases: Record<string, string>,
): string[] {
  return Object.entries(aliases)
    .filter(([, target]) => !index.byName.has(normalizeExerciseName(target)))
    .map(([source, target]) => `${source} -> ${target}`);
}
