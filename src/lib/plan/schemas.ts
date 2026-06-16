import { z } from "zod";

// Plan Editor form schema (Slice 7b form-library standard). No `.default()` so
// input/output types match for the zod 4 resolver. workout_type is carried
// through but only "lifting" is ever produced for new rows (existing rows keep
// their original type, which the form never changes — see slice spec §2).

const workoutRowSchema = z.object({
  workout_id: z.string().uuid().nullable(),
  workout_name: z
    .string()
    .min(1, "Name this session")
    .max(60, "Keep the name under 60 characters"),
  workout_type: z.enum(["lifting", "cardio", "recovery"]),
  timing: z.enum(["am", "anytime", "pm"]),
  gym: z.string().max(60, "Keep the gym under 60 characters"),
  display_order: z.number().int().nonnegative(),
  has_history: z.boolean(),
});

export const daySchema = z.object({
  is_rest_day: z.boolean(),
  workouts: z.array(workoutRowSchema),
});

export type WorkoutRowValues = z.infer<typeof workoutRowSchema>;
export type DayFormValues = z.infer<typeof daySchema>;
