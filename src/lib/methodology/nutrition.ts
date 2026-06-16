import type { Enums } from "@/lib/supabase/types";

// Pure nutrition methodology. No React, no Supabase client — plain functions
// over plain data. Macro→calorie math, target defaults, range status, the
// macro-to-calorie consistency check, and the day-type meal framework all live
// here so the UI and data layers stay presentation/IO-only.

export type GoalMode = Enums<"goal_mode_enum">;
export type NutritionDayType = "rest" | "lifting" | "cardio";
export type MacroKey = "calories" | "protein" | "carbs" | "fat";
export type RangeStatus = "under" | "in" | "over";

/** Atwater factors: kcal per gram of each macronutrient. */
export const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 } as const;

/** Calories implied by a macro split, rounded to a whole number. */
export function macroCalories(
  proteinG: number,
  carbsG: number,
  fatG: number,
): number {
  return Math.round(
    proteinG * MACRO_KCAL.protein +
      carbsG * MACRO_KCAL.carbs +
      fatG * MACRO_KCAL.fat,
  );
}

/** Where a value sits relative to an inclusive [min, max] target range. */
export function rangeStatus(
  value: number,
  min: number,
  max: number,
): RangeStatus {
  if (value < min) {
    return "under";
  }
  if (value > max) {
    return "over";
  }
  return "in";
}

export type NutritionTargetValues = {
  cal_min: number;
  cal_max: number;
  protein_min_g: number;
  protein_max_g: number;
  carbs_min_g: number;
  carbs_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
};

const GOAL_MODE_DEFAULTS: Record<GoalMode, NutritionTargetValues> = {
  cut: {
    cal_min: 2000,
    cal_max: 2400,
    protein_min_g: 180,
    protein_max_g: 220,
    carbs_min_g: 160,
    carbs_max_g: 230,
    fat_min_g: 55,
    fat_max_g: 75,
  },
  maintain: {
    cal_min: 2400,
    cal_max: 2800,
    protein_min_g: 160,
    protein_max_g: 200,
    carbs_min_g: 250,
    carbs_max_g: 320,
    fat_min_g: 70,
    fat_max_g: 90,
  },
  lean_bulk: {
    cal_min: 2800,
    cal_max: 3200,
    protein_min_g: 170,
    protein_max_g: 210,
    carbs_min_g: 320,
    carbs_max_g: 400,
    fat_min_g: 80,
    fat_max_g: 100,
  },
};

/** Seed values for the targets editor when the user has none yet. */
export function goalModeDefaultTargets(
  goalMode: GoalMode,
): NutritionTargetValues {
  return { ...GOAL_MODE_DEFAULTS[goalMode] };
}

export type CaloriesConsistency = {
  derivedMin: number;
  derivedMax: number;
  consistent: boolean;
  message: string;
};

const CONSISTENCY_TOLERANCE = 0.1; // ±10% of the macro-derived calorie range.

/**
 * Cross-checks the entered calorie range against the calories implied by the
 * macro ranges. Informative only — the sole hard rule is the DB's min < max.
 */
export function caloriesConsistency(
  targets: NutritionTargetValues,
): CaloriesConsistency {
  const derivedMin = macroCalories(
    targets.protein_min_g,
    targets.carbs_min_g,
    targets.fat_min_g,
  );
  const derivedMax = macroCalories(
    targets.protein_max_g,
    targets.carbs_max_g,
    targets.fat_max_g,
  );

  const minOk =
    Math.abs(targets.cal_min - derivedMin) <=
    Math.max(1, derivedMin) * CONSISTENCY_TOLERANCE;
  const maxOk =
    Math.abs(targets.cal_max - derivedMax) <=
    Math.max(1, derivedMax) * CONSISTENCY_TOLERANCE;
  const consistent = minOk && maxOk;

  return {
    derivedMin,
    derivedMax,
    consistent,
    message: consistent
      ? `Calories line up with your macros (~${derivedMin}–${derivedMax} kcal).`
      : `Your macro ranges imply ~${derivedMin}–${derivedMax} kcal — adjust the calorie range or the macros to match.`,
  };
}

export type DayTypeFramework = {
  title: string;
  guidance: string;
  emphasis: Exclude<MacroKey, "calories">;
};

const GOAL_MODE_SUFFIX: Record<GoalMode, string> = {
  cut: "Goal: Cut — favour the lower end of your calorie range.",
  maintain: "Goal: Maintain — aim for the middle of your ranges.",
  lean_bulk:
    "Goal: Lean bulk — push toward the upper end without overshooting.",
};

/** Contextual eating guidance for today, keyed off the training day type. */
export function dayTypeFramework(
  dayType: NutritionDayType,
  goalMode: GoalMode,
): DayTypeFramework {
  const base: Record<NutritionDayType, Omit<DayTypeFramework, "guidance">> = {
    rest: {
      title: "Rest day",
      emphasis: "protein",
    },
    lifting: {
      title: "Lifting day",
      emphasis: "carbs",
    },
    cardio: {
      title: "Cardio day",
      emphasis: "carbs",
    },
  };

  const guidanceByType: Record<NutritionDayType, string> = {
    rest: "Lower carbs, keep protein high to support recovery.",
    lifting:
      "Fuel training with carbs around your session; hit protein across the day.",
    cardio:
      "Moderate carbs around your session, stay hydrated, and hit protein.",
  };

  return {
    title: base[dayType].title,
    emphasis: base[dayType].emphasis,
    guidance: `${guidanceByType[dayType]} ${GOAL_MODE_SUFFIX[goalMode]}`,
  };
}

export type TargetToggles = Record<keyof NutritionTargetValues, boolean>;

/**
 * Goal Mode Recommendation merge (5E.1): for each target field, take the
 * recommended default when its toggle is on, otherwise keep the current value.
 */
export function applyTargetToggles(
  current: NutritionTargetValues,
  recommended: NutritionTargetValues,
  toggles: TargetToggles,
): NutritionTargetValues {
  const keys = Object.keys(current) as (keyof NutritionTargetValues)[];
  return keys.reduce((acc, key) => {
    acc[key] = toggles[key] ? recommended[key] : current[key];
    return acc;
  }, {} as NutritionTargetValues);
}
