import type { Enums } from "@/lib/supabase/types";

/**
 * A single workout on the Today screen, as projected by the Today page's
 * `getTodaySessions` fetch. Shared by the focal Start card and the "Also today"
 * list. Presentational shape only — no query lives here.
 */
export type TodaySession = {
  workoutId: string;
  workoutType: Enums<"session_type_enum">;
  workoutName: string;
  timing: Enums<"timing_enum">;
  gym: string | null;
  displayOrder: number;
  /** True when a lifting workout has a finished completion logged today. */
  completed: boolean;
  summary: string;
};
