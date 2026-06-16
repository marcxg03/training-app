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

export type MealEntry = {
  meal_id: string;
  meal_type: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
  note: string | null;
  logged_at: string;
};

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MacroBar = {
  key: MacroKey;
  label: string;
  unit: string;
  total: number;
  min: number;
  max: number;
  status: RangeStatus;
};

export type { NutritionDayType };
