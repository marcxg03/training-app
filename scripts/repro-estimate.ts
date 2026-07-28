// Temporary repro for the "Estimation failed" 502 — mirrors the exact call in
// src/app/api/estimate-macros/route.ts, text-only input.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { macroEstimateSchema } from "../src/lib/nutrition/macro-estimate";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: "You estimate the macronutrients of a meal from a description.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: 'Estimate the macros for this meal from this description:\n"200g grilled chicken breast with a cup of white rice"',
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(macroEstimateSchema) },
  });
  console.log("stop_reason:", response.stop_reason);
  console.log("parsed_output:", JSON.stringify(response.parsed_output, null, 2));
}

main().catch((err) => {
  console.error("REPRO FAILED:");
  console.error(err);
  process.exit(1);
});
