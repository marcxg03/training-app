import { z } from "zod";

// Profile form schema (Slice 7b form-library standard). Bodyweight and height
// are optional positive numbers (null when blank). display_name is optional.
// No `.default()` so input and output types match for the zod 4 resolver.

const optionalPositive = (label: string) =>
  z
    .number({ error: `Enter ${label} as a number` })
    .positive(`${label} must be greater than 0`)
    .max(1000, "That looks too high")
    .nullable();

export const profileSchema = z.object({
  display_name: z.string().trim().max(80, "Keep the name under 80 characters"),
  bodyweight_kg: optionalPositive("bodyweight"),
  height_cm: optionalPositive("height"),
  goal_mode: z.enum(["cut", "maintain", "lean_bulk"]),
  // IANA identifier; validated against the runtime's own list in the form.
  timezone: z.string().min(1, "Pick a timezone"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
