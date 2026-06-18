import { z } from "zod";

import type { Database } from "@/lib/supabase/types";
import { nameConflicts } from "@/lib/library/uniqueness";

export const PRIMARY_MUSCLE_GROUPS = [
  { value: "chest", label: "Chest" },
  { value: "shoulders", label: "Shoulders" },
  { value: "back", label: "Back" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "calves", label: "Calves" },
] as const;

export const SPECIFIC_MUSCLE_GROUPS = [
  { value: "lats", label: "Lats" },
  { value: "upper_back", label: "Upper Back" },
  { value: "teres_major", label: "Teres Major" },
  { value: "rear_delts", label: "Rear Delts" },
] as const;

export const MUSCLE_GROUPS = [
  ...PRIMARY_MUSCLE_GROUPS,
  ...SPECIFIC_MUSCLE_GROUPS,
] as const;

export const MUSCLE_GROUP_VALUES = MUSCLE_GROUPS.map(
  (group) => group.value,
) as [
  (typeof MUSCLE_GROUPS)[number]["value"],
  ...(typeof MUSCLE_GROUPS)[number]["value"][],
];

export function isMuscleGroup(value: string): value is MuscleGroup {
  return MUSCLE_GROUP_VALUES.includes(value as MuscleGroup);
}

const blockCategorySchema = z.enum(["lifting", "cardio", "recovery"]);
const blockTypeSchema = z.enum(["failure", "mobility", "corrective"]);
const cardioFormatSchema = z.enum(["speed_run", "endurance_run", "basketball"]);
const cardioTargetZoneSchema = z.enum([
  "sprint",
  "zone_2",
  "anaerobic",
  "game_pace",
]);

const bankItemSchema = z.object({
  exercise_id: z.string().uuid(),
  display_order: z.number().int().min(0),
});

export type BlockCategory = Database["public"]["Enums"]["block_category_enum"];
export type BlockType = Database["public"]["Enums"]["block_type_enum"];
export type CardioFormat = Database["public"]["Enums"]["cardio_format_enum"];
export type CardioTargetZone =
  Database["public"]["Enums"]["cardio_target_zone_enum"];
export type MuscleGroup = (typeof MUSCLE_GROUP_VALUES)[number];

export const blockSchema = z
  .object({
    own_id: z.string().uuid().optional(),
    block_name: z
      .string()
      .trim()
      .min(1, "Block name is required.")
      .max(80, "Block name must be 80 characters or fewer."),
    block_category: blockCategorySchema,
    block_type: blockTypeSchema.nullable(),
    bank: z.array(bankItemSchema),
  })
  .refine(
    (values) =>
      values.block_category === "lifting" ? values.block_type !== null : true,
    {
      path: ["block_type"],
      message: "Lifting blocks require a protocol.",
    },
  )
  .refine(
    (values) =>
      values.block_category === "lifting" ? true : values.block_type === null,
    {
      path: ["block_type"],
      message: "Only lifting blocks can have a protocol.",
    },
  )
  .refine(
    async (values) =>
      !(await nameConflicts({
        table: "blocks",
        name: values.block_name,
        ownId: values.own_id,
      })),
    {
      path: ["block_name"],
      message: "A block with this name already exists.",
    },
  );

export const exerciseSchema = z
  .object({
    own_id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Exercise name is required.")
      .max(80, "Exercise name must be 80 characters or fewer."),
    muscle_groups: z
      .array(z.enum(MUSCLE_GROUP_VALUES))
      .min(1, "Pick at least one muscle group."),
    is_bodyweight: z.boolean(),
    prescribed_min: z.number().int().min(1, "Minimum reps must be at least 1."),
    prescribed_max: z.number().int().min(1, "Maximum reps must be at least 1."),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer."),
  })
  .refine((values) => values.prescribed_max >= values.prescribed_min, {
    path: ["prescribed_max"],
    message: "Maximum reps must be greater than or equal to minimum reps.",
  })
  .refine(
    async (values) =>
      !(await nameConflicts({
        table: "exercises",
        name: values.name,
        ownId: values.own_id,
      })),
    {
      path: ["name"],
      message: "An exercise with this name already exists.",
    },
  );

export const cardioActivitySchema = z
  .object({
    own_id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Activity name is required.")
      .max(80, "Activity name must be 80 characters or fewer."),
    cardio_format: cardioFormatSchema.optional(),
    cardio_distance: z
      .string()
      .trim()
      .max(40, "Distance must be 40 characters or fewer."),
    cardio_target_zone: cardioTargetZoneSchema.optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description must be 1000 characters or fewer."),
  })
  .refine((values) => values.cardio_format !== undefined, {
    path: ["cardio_format"],
    message: "Pick a format.",
  })
  .refine((values) => values.cardio_target_zone !== undefined, {
    path: ["cardio_target_zone"],
    message: "Pick a target zone.",
  })
  .refine(
    async (values) =>
      !(await nameConflicts({
        table: "cardio_activities",
        name: values.name,
        ownId: values.own_id,
      })),
    {
      path: ["name"],
      message: "A cardio activity with this name already exists.",
    },
  );

export const recoveryActivitySchema = z
  .object({
    own_id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Activity name is required.")
      .max(80, "Activity name must be 80 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(1000, "Description must be 1000 characters or fewer."),
  })
  .refine(
    async (values) =>
      !(await nameConflicts({
        table: "recovery_activities",
        name: values.name,
        ownId: values.own_id,
      })),
    {
      path: ["name"],
      message: "A recovery activity with this name already exists.",
    },
  );

const workoutBlockItemSchema = z.object({
  block_id: z.string().uuid(),
  display_order: z.number().int().min(0),
});

// A reusable workout is a name + an ordered list of lifting blocks. Contents are
// edited only here (single source of truth); plans reference the workout.
export const workoutDefSchema = z
  .object({
    own_id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Workout name is required.")
      .max(80, "Workout name must be 80 characters or fewer."),
    blocks: z.array(workoutBlockItemSchema),
  })
  .refine(
    (values) =>
      new Set(values.blocks.map((block) => block.block_id)).size ===
      values.blocks.length,
    {
      path: ["blocks"],
      message: "A block can only be added once.",
    },
  )
  .refine(
    async (values) =>
      !(await nameConflicts({
        table: "workout_defs",
        name: values.name,
        ownId: values.own_id,
      })),
    {
      path: ["name"],
      message: "A workout with this name already exists.",
    },
  );

export type BlockFormValues = z.infer<typeof blockSchema>;
export type ExerciseFormValues = z.infer<typeof exerciseSchema>;
export type CardioActivityFormValues = z.infer<typeof cardioActivitySchema>;
export type RecoveryActivityFormValues = z.infer<typeof recoveryActivitySchema>;
export type WorkoutDefFormValues = z.infer<typeof workoutDefSchema>;
