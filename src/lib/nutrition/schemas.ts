import { z } from "zod";

// Zod schemas for the Nutrition forms (Slice 7b form-library standard). Form
// value types derive from these via z.infer — no hand-rolled types. No async
// refines here: meal logging has no uniqueness rule and targets is a per-user
// upsert. The min < max refines mirror the DB CHECK constraints (strict).
//
// Note: no `.default()` is used on any field. Defaults are supplied via
// react-hook-form `defaultValues` instead, which keeps each schema's input and
// output types identical — required for the zod 4 + @hookform/resolvers typing
// to line up with `useForm<z.infer<...>>`.

export const mealSchema = z.object({
  meal_type: z
    .string()
    .trim()
    .min(1, "Name this meal (e.g. Breakfast)")
    .max(60, "Keep the meal name under 60 characters"),
  protein_g: z
    .number({ error: "Enter protein in grams" })
    .min(0, "Protein can't be negative")
    .max(1000, "That looks too high"),
  carbs_g: z
    .number({ error: "Enter carbs in grams" })
    .min(0, "Carbs can't be negative")
    .max(1000, "That looks too high"),
  fat_g: z
    .number({ error: "Enter fat in grams" })
    .min(0, "Fat can't be negative")
    .max(1000, "That looks too high"),
  note: z.string().max(500, "Keep the note under 500 characters"),
});

export type MealFormValues = z.infer<typeof mealSchema>;

const intField = (label: string) =>
  z
    .number({ error: `Enter ${label}` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(100000, "That looks too high");

export const targetsSchema = z
  .object({
    cal_min: intField("minimum calories"),
    cal_max: intField("maximum calories"),
    protein_min_g: intField("minimum protein"),
    protein_max_g: intField("maximum protein"),
    carbs_min_g: intField("minimum carbs"),
    carbs_max_g: intField("maximum carbs"),
    fat_min_g: intField("minimum fat"),
    fat_max_g: intField("maximum fat"),
  })
  .refine((d) => d.cal_min < d.cal_max, {
    message: "Maximum calories must be greater than minimum",
    path: ["cal_max"],
  })
  .refine((d) => d.protein_min_g < d.protein_max_g, {
    message: "Maximum protein must be greater than minimum",
    path: ["protein_max_g"],
  })
  .refine((d) => d.carbs_min_g < d.carbs_max_g, {
    message: "Maximum carbs must be greater than minimum",
    path: ["carbs_max_g"],
  })
  .refine((d) => d.fat_min_g < d.fat_max_g, {
    message: "Maximum fat must be greater than minimum",
    path: ["fat_max_g"],
  });

export type TargetsFormValues = z.infer<typeof targetsSchema>;
