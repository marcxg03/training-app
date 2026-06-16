import { z } from "zod";

// Shared contract for the AI photo macro estimator (Slice 14). Pure data — no
// React, no Supabase, no Anthropic import — so the server route and the client
// form type the same payload. The estimate is inherently a [min, max] range per
// macro; it prefills LogMealSheet in range mode.

// Plain numbers only: structured outputs don't enforce numeric bounds, so the
// route clamps/sanitizes the model's output before returning it.
export const macroEstimateSchema = z.object({
  meal_type: z
    .string()
    .describe("A short name for the meal, e.g. 'Grilled chicken salad'."),
  protein_min_g: z.number().describe("Low estimate of protein in grams."),
  protein_max_g: z.number().describe("High estimate of protein in grams."),
  carbs_min_g: z.number().describe("Low estimate of carbohydrates in grams."),
  carbs_max_g: z.number().describe("High estimate of carbohydrates in grams."),
  fat_min_g: z.number().describe("Low estimate of fat in grams."),
  fat_max_g: z.number().describe("High estimate of fat in grams."),
  notes: z
    .string()
    .describe(
      "One short sentence on the foods identified and any assumptions.",
    ),
});

export type MacroEstimate = z.infer<typeof macroEstimateSchema>;

// Accepted upload formats — mirrors Anthropic's supported image media types.
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

// Cap the upload so a large phone photo can't blow the request limit. Anthropic
// accepts up to ~5MB per image; we stay under it and reject earlier client-side.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
