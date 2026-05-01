import type { Enums, Tables } from "@/lib/supabase/types";

type DetectableSetLog = Pick<
  Tables<"set_logs">,
  | "exercise_id"
  | "weight_kg"
  | "reps"
  | "prescribed_min"
  | "prescribed_max"
  | "logged_at"
>;

export type PRDetection = {
  achievedAt: string;
  exerciseId: string;
  prType: Enums<"pr_type_enum">;
  reps: number;
  weightKg: number;
};

type PRDetectionContext = {
  isBodyweight: boolean;
  maxRepsAtWeight: number | null;
  maxWeightKg: number | null;
};

export function detectPRs(
  setLog: DetectableSetLog,
  context: PRDetectionContext,
) {
  if (context.isBodyweight || setLog.reps < 1 || setLog.weight_kg === null) {
    return [] as PRDetection[];
  }

  const detections: PRDetection[] = [];

  if (context.maxWeightKg === null || setLog.weight_kg > context.maxWeightKg) {
    detections.push({
      achievedAt: setLog.logged_at,
      exerciseId: setLog.exercise_id,
      prType: "weight",
      reps: setLog.reps,
      weightKg: setLog.weight_kg,
    });
  }

  const isInRange =
    setLog.reps >= setLog.prescribed_min &&
    setLog.reps <= setLog.prescribed_max;

  if (
    isInRange &&
    (context.maxRepsAtWeight === null || setLog.reps > context.maxRepsAtWeight)
  ) {
    detections.push({
      achievedAt: setLog.logged_at,
      exerciseId: setLog.exercise_id,
      prType: "in_range_rep",
      reps: setLog.reps,
      weightKg: setLog.weight_kg,
    });
  }

  return detections;
}
