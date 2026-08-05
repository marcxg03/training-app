import { z } from "zod";

// Plan Editor form schema (Slice 7b form-library standard). No `.default()` so
// input/output types match for the zod 4 resolver. NEW rows may now be lifting,
// cardio, or recovery (the "Add session" menu picks the type). Existing rows keep
// their original type — the form never rewrites an existing row's type/cardio
// fields (see slice spec §2 and saveDay's update branch).

const cardioFormatSchema = z.enum(["speed_run", "endurance_run", "basketball"]);

const workoutRowSchema = z
  .object({
    workout_id: z.string().uuid().nullable(),
    workout_name: z
      .string()
      .min(1, "Name this session")
      .max(60, "Keep the name under 60 characters"),
    workout_type: z.enum(["lifting", "cardio", "recovery"]),
    // Mirrors the DB workouts CHECK: a cardio session carries a format; a
    // non-cardio (lifting/recovery) session must not. Nullable so lifting/
    // recovery rows and existing rows (never re-inserted) validate cleanly.
    cardio_format: cardioFormatSchema.nullable(),
    timing: z.enum(["am", "anytime", "pm"]),
    gym: z.string().max(60, "Keep the gym under 60 characters"),
    display_order: z.number().int().nonnegative(),
    has_history: z.boolean(),
  })
  .superRefine((row, ctx) => {
    if (row.workout_type === "cardio") {
      // Only NEW cardio rows are inserted (and the DB CHECK requires a format);
      // existing cardio rows are updated in place and don't rewrite cardio_*.
      if (row.workout_id === null && !row.cardio_format) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cardio_format"],
          message: "Pick a cardio format",
        });
      }
    } else if (row.cardio_format) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardio_format"],
        message: "Only cardio sessions have a format",
      });
    }
  });

export const daySchema = z.object({
  is_rest_day: z.boolean(),
  workouts: z.array(workoutRowSchema),
});

export type WorkoutRowValues = z.infer<typeof workoutRowSchema>;
export type DayFormValues = z.infer<typeof daySchema>;
