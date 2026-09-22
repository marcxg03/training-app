"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import type { LoggerExercise } from "@/lib/methodology/workout-state";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type AddExerciseSheetProps = {
  /** The whole owned catalog; entries already in this block are filtered out. */
  catalog: LoggerExercise[];
  /** Exercises already offered for this block (bank + anything added today). */
  existingExerciseIds: string[];
  userId: string;
  onAdd: (exercise: LoggerExercise) => void;
};

const DEFAULT_MIN = 6;
const DEFAULT_MAX = 8;

/** Adds an exercise to the block **for this session only**.
 *
 * Nothing here writes `block_lifting_items`, so the plan is untouched: the
 * exercise lives in local logger state, and the set logged against it carries
 * the `exercise_id` directly. A newly created exercise IS saved to the Library
 * (that is the point of creating it) — it is simply not added to this block's
 * prescription. */
export function AddExerciseSheet({
  catalog,
  existingExerciseIds,
  userId,
  onAdd,
}: AddExerciseSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [name, setName] = useState("");
  const [minReps, setMinReps] = useState(String(DEFAULT_MIN));
  const [maxReps, setMaxReps] = useState(String(DEFAULT_MAX));
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const existing = useMemo(
    () => new Set(existingExerciseIds),
    [existingExerciseIds],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
      .filter((exercise) => !existing.has(exercise.exercise_id))
      .filter(
        (exercise) =>
          needle.length === 0 || exercise.name.toLowerCase().includes(needle),
      );
  }, [catalog, existing, query]);

  function reset() {
    setQuery("");
    setMode("pick");
    setName("");
    setMinReps(String(DEFAULT_MIN));
    setMaxReps(String(DEFAULT_MAX));
    setIsBodyweight(false);
    setError(null);
  }

  function accept(exercise: LoggerExercise) {
    onAdd(exercise);
    setOpen(false);
    reset();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    const min = Number(minReps);
    const max = Number(maxReps);

    if (!trimmed) {
      setError("Name the exercise.");
      return;
    }
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1) {
      setError("Rep range must be whole numbers, 1 or more.");
      return;
    }
    if (max < min) {
      setError("Max reps can't be below min reps.");
      return;
    }

    setError(null);
    setIsSaving(true);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("exercises")
      .insert({
        user_id: userId,
        name: trimmed,
        prescribed_min: min,
        prescribed_max: max,
        is_bodyweight: isBodyweight,
      })
      .select(
        "exercise_id, name, notes, prescribed_min, prescribed_max, muscle_groups, is_bodyweight",
      )
      .single();

    setIsSaving(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "You already have an exercise with that name — find it in the list instead."
          : insertError.message,
      );
      return;
    }

    accept(data);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 uppercase tracking-[0.06em]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add exercise
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add an exercise</SheetTitle>
        </SheetHeader>

        <p className="mt-1 text-[13px] text-muted-foreground">
          For this session only — your plan stays as it is.
        </p>

        <div className="mt-4 flex gap-1.5">
          {(
            [
              { value: "pick", label: "From my bank" },
              { value: "create", label: "New exercise" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setMode(tab.value);
                setError(null);
              }}
              aria-pressed={mode === tab.value}
              className={
                mode === tab.value
                  ? "flex-1 rounded-lg bg-accent px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent-foreground"
                  : "flex-1 rounded-lg border border-border px-3 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "pick" ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your exercises"
                aria-label="Search your exercises"
                autoComplete="off"
                className="pl-9"
              />
            </div>

            {matches.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                {catalog.length === existing.size
                  ? "Every exercise you own is already in this block."
                  : "No exercise matches that search."}
              </p>
            ) : (
              <ul className="space-y-2">
                {matches.map((exercise) => (
                  <li key={exercise.exercise_id}>
                    <button
                      type="button"
                      onClick={() => accept(exercise)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-accent/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
                        {exercise.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
                        {exercise.prescribed_min}–{exercise.prescribed_max}
                        {exercise.is_bodyweight ? " · BW" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="adhoc-exercise-name" className="eyebrow block">
                Name
              </label>
              <Input
                id="adhoc-exercise-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="adhoc-min" className="eyebrow block">
                  Min reps
                </label>
                <Input
                  id="adhoc-min"
                  inputMode="numeric"
                  value={minReps}
                  onChange={(event) => setMinReps(event.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label htmlFor="adhoc-max" className="eyebrow block">
                  Max reps
                </label>
                <Input
                  id="adhoc-max"
                  inputMode="numeric"
                  value={maxReps}
                  onChange={(event) => setMaxReps(event.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isBodyweight}
              onClick={() => setIsBodyweight((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-2.5"
            >
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
                Bodyweight
              </span>
              <span
                className={
                  isBodyweight
                    ? "inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-accent px-0.5"
                    : "inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-border px-0.5"
                }
              >
                <span
                  className={
                    isBodyweight
                      ? "h-5 w-5 translate-x-5 rounded-full bg-black transition-transform"
                      : "h-5 w-5 rounded-full bg-card transition-transform"
                  }
                />
              </span>
            </button>

            <p className="text-[12px] text-faint">
              Saved to your Library so you can reuse it — but not added to this
              block&rsquo;s plan.
            </p>

            <Button
              type="button"
              onClick={handleCreate}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? "Saving…" : "Create and use"}
            </Button>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </SheetContent>
    </Sheet>
  );
}
