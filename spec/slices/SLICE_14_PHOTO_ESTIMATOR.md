# SLICE_14_PHOTO_ESTIMATOR.md

> Slice 14 — AI photo macro estimator (Claude vision). Solo-built.
> No migration (reuses Slice 13's range columns).

## Goal

Let the user photograph a meal and have Claude estimate protein/carbs/fat as
min–max gram ranges that prefill `LogMealSheet` in range mode. The estimate is
inherently a range, which is why Slice 13's ranges landed first. Fully
env-gated: with no `ANTHROPIC_API_KEY` the feature is invisible and entry stays
manual. The photo is sent to Anthropic (the user's explicit choice).

## Contracts

- `nutrition/macro-estimate.ts` (pure — only imports zod): `macroEstimateSchema`
  (meal_type + six macro numbers + notes), `MacroEstimate`, `ACCEPTED_IMAGE_TYPES`,
  `MAX_IMAGE_BYTES`. Shared by the route and the client so both type the payload.
- `app/api/estimate-macros/route.ts` (server-only): POST `{ image: base64,
  mediaType }`. Order of gates — **auth (401) → env key (503) → input validation
  (400/413)** — then `claude-opus-4-8` vision via `messages.parse()` with
  `output_config.format = zodOutputFormat(macroEstimateSchema)`. `sanitize()`
  clamps each macro to whole grams 0–1000 and enforces max ≥ min (mirrors
  `gramsField` + migration 018 CHECK); blank model name falls back to "Meal".
  Refusal / null `parsed_output` → 422; SDK/network error → 502 (logged
  server-side, never leaked).
- `LogMealSheet`: new `aiEnabled` prop. When true, an "Estimate from photo"
  button (hidden file input, `capture="environment"`) reads the file as base64,
  POSTs it, and on success calls `applyEstimate` — flips to range mode, fills the
  six macro fields outright, and fills name/note only if still blank (never
  clobbers typed input). `estimating` disables the button; errors surface inline.
- `MealsSection` / `page.tsx`: thread `aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}`
  (a boolean — the key never reaches the client bundle).

## Acceptance criteria

1. With `ANTHROPIC_API_KEY` set: tapping "Estimate from photo", choosing a meal
   photo, prefills the form in range mode with a name + macro ranges + note; the
   calorie-range preview updates; the user can adjust and save normally.
2. With the key unset: no photo button; manual entry unchanged.
3. The route rejects unauthenticated requests (401) before any Anthropic call,
   rejects non-image / oversized uploads (400/413), and returns a friendly
   "enter manually" message on refusal/error rather than throwing.
4. The Anthropic key is server-only (never in the client bundle); the uploaded
   photo is the only user data sent to Anthropic.
5. typecheck / lint / format / build clean; no console errors.

## Out of scope

- Persisting or displaying the photo (estimate only; the image is not stored).
- Multi-item itemized breakdowns; barcode/label scanning.
- Library delete (Slice 15).
