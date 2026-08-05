import { z } from "zod";

// Plan Editor form schema (Slice 7b form-library standard). No `.default()` so
// input/output types match for the zod 4 resolver. NEW rows may now be lifting,
// cardio, or recovery (the "Add session" menu picks the type). Existing rows keep
// their original type — the form never rewrites an existing row's type/cardio
// fields (see slice spec §2 and saveDay's update branch).

const cardioFormatSchema = z.enum(["speed_run", "endurance_run", "basketball"]);

// One row of a session's content (a `workout_blocks` row). `preset_activity_id`
// is only meaningful on a cardio/recovery session — see blockRowsRule below.
const blockRowSchema = z.object({
  block_id: z.string().uuid(),
  block_name: z.string(),
  preset_activity_id: z.string().uuid().nullable(),
});

const workoutRowSchema = z
  .object({
    workout_id: z.string().uuid().nullable(),
    workout_def_id: z.string().uuid().nullable(),
    workout_name: z
      .string()
      .min(1, "Name this session")
      .max(60, "Keep the name under 60 characters"),
    workout_type: z.enum(["lifting", "cardio", "recovery"]),
    blocks: z.array(blockRowSchema),
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

    // Session content. A cardio/recovery session is exactly one category block
    // carrying a preset activity (Long Run, Sauna, …) — that is what the day
    // view renders and what the seed writes. A lifting session is an ordered
    // list of blocks and never carries a preset.
    if (row.workout_type === "lifting") {
      if (row.blocks.some((block) => block.preset_activity_id !== null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks"],
          message: "Only cardio and recovery sessions have a preset activity",
        });
      }

      // workout_blocks is keyed (workout_id, block_id, display_order); the same
      // block twice would also read as a duplicate in the logger.
      const seen = new Set<string>();
      for (const block of row.blocks) {
        if (seen.has(block.block_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blocks"],
            message: `"${block.block_name}" is already in this session`,
          });
          break;
        }
        seen.add(block.block_id);
      }
    } else if (row.blocks.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks"],
        message: "A cardio or recovery session holds a single activity",
      });
    } else if (row.blocks.length === 1 && !row.blocks[0].preset_activity_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks"],
        message: "Pick an activity for this session",
      });
    }
  });

export const daySchema = z.object({
  is_rest_day: z.boolean(),
  workouts: z.array(workoutRowSchema),
});

export type WorkoutRowValues = z.infer<typeof workoutRowSchema>;
export type DayFormValues = z.infer<typeof daySchema>;
