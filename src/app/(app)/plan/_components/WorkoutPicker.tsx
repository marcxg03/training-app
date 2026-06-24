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
import type { WorkoutDefOption } from "@/lib/plan/projections";

type WorkoutPickerProps = {
  catalog: WorkoutDefOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (workoutDefId: string) => void;
};

export function WorkoutPicker({
  catalog,
  open,
  onOpenChange,
  onSelect,
}: WorkoutPickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add workout to this day</SheetTitle>
          <SheetDescription>
            Pick a workout from your catalog. Build new ones in Library →
            Workouts.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Command className="rounded-xl border border-border/70">
            <CommandInput placeholder="Search workouts..." />
            <CommandList>
              <CommandEmpty>No workouts in your catalog yet.</CommandEmpty>
              <CommandGroup heading="Workouts">
                {catalog.map((workout) => (
                  <CommandItem
                    key={workout.workout_def_id}
                    onSelect={() => {
                      onSelect(workout.workout_def_id);
                      onOpenChange(false);
                    }}
                  >
                    <span className="font-medium">{workout.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </SheetContent>
    </Sheet>
  );
}
