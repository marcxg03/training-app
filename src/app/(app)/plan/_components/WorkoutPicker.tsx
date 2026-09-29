"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SessionOption } from "@/lib/plan/projections";

/**
 * The week editor's session picker (T3-G).
 *
 * WAS workouts-only, and that was the bug Marcus hit: "when i add workouts i
 * can only add created workouts but no cardio or recovery sessions when I edit
 * the plan." The picker read `workout_defs`, and a cardio or recovery session
 * has no definition — it IS an activity — so the list structurally could not
 * contain them, and the only place to add one was the day editor.
 *
 * Now it offers all three kinds in one list, grouped, which is what he asked
 * for: "just add workout, recovery, or cardio as a session that is predefined
 * as a block, just like how i can add workouts from workouts created out of
 * blocks."
 *
 * Each group renders ONLY when it has options, and the empty state says which
 * Library surface fills the gap — a group of one heading and no rows tells you
 * nothing about what to do next.
 */

type WorkoutPickerProps = {
  options: SessionOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (option: SessionOption) => void;
};

const GROUPS = [
  { kind: "workout", heading: "Workouts", hint: "Library → Workouts" },
  { kind: "cardio", heading: "Cardio", hint: "Library → Cardio" },
  { kind: "recovery", heading: "Recovery", hint: "Library → Recovery" },
] as const;

export function WorkoutPicker({
  options,
  open,
  onOpenChange,
  onSelect,
}: WorkoutPickerProps) {
  const missing = GROUPS.filter(
    (group) => !options.some((option) => option.kind === group.kind),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add a session to this day</SheetTitle>
          <SheetDescription>
            A workout from your catalog, or a cardio or recovery activity.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Command className="rounded-xl border border-border/70">
            <CommandInput placeholder="Search sessions..." />
            <CommandList>
              <CommandEmpty>
                Nothing in your Library yet — build a workout, cardio or
                recovery activity first.
              </CommandEmpty>

              {GROUPS.map((group) => {
                const items = options.filter(
                  (option) => option.kind === group.kind,
                );

                if (items.length === 0) {
                  return null;
                }

                return (
                  <CommandGroup key={group.kind} heading={group.heading}>
                    {items.map((option) => (
                      <CommandItem
                        key={`${option.kind}:${option.id}`}
                        // cmdk filters on this, so searching "run" finds a
                        // cardio activity without the user knowing which
                        // group it lives in.
                        value={`${option.name} ${group.heading}`}
                        onSelect={() => {
                          onSelect(option);
                          onOpenChange(false);
                        }}
                      >
                        <span className="font-medium">{option.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>

          {missing.length > 0 ? (
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              No{" "}
              {missing.map((group) => group.heading.toLowerCase()).join(" or ")}{" "}
              in your Library yet — add {missing.length > 1 ? "them" : "one"} in{" "}
              {missing.map((group) => group.hint).join(" / ")}.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
