import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  macroEstimateSchema,
  type AcceptedImageType,
  type MacroEstimate,
} from "@/lib/nutrition/macro-estimate";
import { createClient } from "@/lib/supabase/server";

// Slice 14 — AI photo macro estimator. Accepts a base64 food photo, asks Claude
// vision for a macro-range estimate (structured JSON), and returns it to prefill
// LogMealSheet. Env-gated on ANTHROPIC_API_KEY: degrades to manual entry (503)
// when the key is absent. The photo is sent to Anthropic per the user's request.

const SYSTEM_PROMPT = `You estimate the macronutrients of a meal from a photo.

Identify the foods and their likely portion sizes, then estimate protein, carbohydrates, and fat in grams. Express each as a low–high gram range that honestly reflects portion uncertainty — wider when the photo is ambiguous, tighter when portions are clear. Do not estimate calories; they are derived from the macros elsewhere.

Give the meal a short descriptive name. In notes, list the foods you identified in one sentence and flag any major assumption. If the image contains no food, return zeros for every macro and say so in notes.`;

// Round to whole grams: a photo estimate has no meaningful sub-gram precision,
// and the form/DB (numeric, 0–1000) accept the result. Caps mirror gramsField
// and the migration 018 CHECK.
function clamp(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(Math.round(value), 1000);
}

// The model returns plausible but unbounded numbers; enforce the same invariants
// the form and DB require (non-negative, max >= min, capped) before returning.
function sanitize(estimate: MacroEstimate): MacroEstimate {
  const pair = (min: number, max: number): [number, number] => {
    const lo = clamp(min);
    const hi = clamp(max);
    return lo <= hi ? [lo, hi] : [hi, lo];
  };
  const [protein_min_g, protein_max_g] = pair(
    estimate.protein_min_g,
    estimate.protein_max_g,
  );
  const [carbs_min_g, carbs_max_g] = pair(
    estimate.carbs_min_g,
    estimate.carbs_max_g,
  );
  const [fat_min_g, fat_max_g] = pair(estimate.fat_min_g, estimate.fat_max_g);
  return {
    // mealSchema requires a non-empty name; fall back if the model returns "".
    meal_type: estimate.meal_type.trim().slice(0, 60) || "Meal",
    protein_min_g,
    protein_max_g,
    carbs_min_g,
    carbs_max_g,
    fat_min_g,
    fat_max_g,
    notes: estimate.notes.slice(0, 500),
  };
}

export async function POST(request: Request) {
  // Auth gate — never an open proxy to the Anthropic key.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Env gate — graceful fallback to manual entry when the key isn't configured.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Photo estimation isn't configured. Enter macros manually." },
      { status: 503 },
    );
  }

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { image, mediaType } = body;
  if (typeof image !== "string" || typeof mediaType !== "string") {
    return NextResponse.json({ error: "Missing image data." }, { status: 400 });
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(mediaType as AcceptedImageType)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, or GIF photo." },
      { status: 400 },
    );
  }
  // base64 is ~4/3 of the byte size; reject oversized uploads before the call.
  if (image.length > Math.ceil(MAX_IMAGE_BYTES * 1.37)) {
    return NextResponse.json(
      { error: "That photo is too large. Try one under 4 MB." },
      { status: 413 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as AcceptedImageType,
                data: image,
              },
            },
            {
              type: "text",
              text: "Estimate the macros for this meal.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(macroEstimateSchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { error: "Couldn't read that photo. Enter macros manually." },
        { status: 422 },
      );
    }

    return NextResponse.json(sanitize(response.parsed_output));
  } catch (error) {
    console.error("estimate-macros failed", error);
    return NextResponse.json(
      { error: "Estimation failed. Enter macros manually." },
      { status: 502 },
    );
  }
}
