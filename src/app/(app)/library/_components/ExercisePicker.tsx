"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { ExerciseEditSheet } from "@/app/(app)/library/_components/ExerciseEditSheet";
import { Button } from "@/components/ui/button";
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
import type { ExerciseListItem } from "@/lib/library/projections";

type ExercisePickerProps = {
  exercises: ExerciseListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onSelect: (exerciseId: string) => void;
};

export function ExercisePicker({
  exercises,
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: ExercisePickerProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [localExercises, setLocalExercises] = useState(exercises);

  useEffect(() => {
    setLocalExercises(exercises);
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const excluded = new Set(excludeIds);

    return localExercises.filter(
      (exercise) => !excluded.has(exercise.exercise_id),
    );
  }, [excludeIds, localExercises]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="mx-auto max-w-2xl">
          <SheetHeader>
            <SheetTitle>Add exercise to bank</SheetTitle>
            <SheetDescription>
              Pick an existing exercise or create a new one inline.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new exercise
            </Button>

            <Command className="rounded-xl border border-border/70">
              <CommandInput placeholder="Search exercises..." />
              <CommandList>
                <CommandEmpty>No exercises available.</CommandEmpty>
                <CommandGroup heading="Exercises">
                  {filteredExercises.map((exercise) => (
                    <CommandItem
                      key={exercise.exercise_id}
                      onSelect={() => {
                        onSelect(exercise.exercise_id);
                        onOpenChange(false);
                      }}
                    >
                      <div>
                        <p className="font-medium">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.primary_muscle_group_label ??
                            "Uncategorized"}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </SheetContent>
      </Sheet>

      <ExerciseEditSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onCreated={(exercise) => {
          setLocalExercises((current) =>
            [...current, exercise].sort((left, right) =>
              left.name.localeCompare(right.name),
            ),
          );
          router.refresh();
          onSelect(exercise.exercise_id);
          setCreateOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
