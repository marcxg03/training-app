import type {
  MacroKey,
  NutritionDayType,
  RangeStatus,
} from "@/lib/methodology/nutrition";

// View-model shapes for the Nutrition tab. Plain data; no React, no Supabase.

export type NutritionTargets = {
  cal_min: number;
  cal_max: number;
  protein_min_g: number;
  protein_max_g: number;
  carbs_min_g: number;
  carbs_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
};

/** A logged meal. Every macro and calories are stored as a [min, max] range
 * (an exact entry has min === max). */
export type MealEntry = {
  meal_id: string;
  meal_type: string;
  protein_min_g: number;
  protein_max_g: number;
  carbs_min_g: number;
  carbs_max_g: number;
  fat_min_g: number;
  fat_max_g: number;
  cal_min: number;
  cal_max: number;
  note: string | null;
  logged_at: string;
};

export type Range = { min: number; max: number };

export type MacroTotals = {
  calories: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
};

export type MacroBar = {
  key: MacroKey;
  label: string;
  unit: string;
  totalMin: number;
  totalMax: number;
  min: number;
  max: number;
  status: RangeStatus;
};

export type { NutritionDayType };

