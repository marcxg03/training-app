import type { GoalMode } from "@/lib/methodology/nutrition";

export type Profile = {
  display_name: string | null;
  bodyweight_kg: number | null;
  height_cm: number | null;
  goal_mode: GoalMode;
};
