"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { BankItemRow } from "@/app/(app)/library/_components/BankItemRow";
import { ExercisePicker } from "@/app/(app)/library/_components/ExercisePicker";
import { Button } from "@/components/ui/button";
import type { ExerciseListItem } from "@/lib/library/projections";
import type { BlockFormValues } from "@/lib/library/schemas";

type BankCompositionProps = {
  exercises: ExerciseListItem[];
};

function normalizeBank(bank: BlockFormValues["bank"]): BlockFormValues["bank"] {
  return bank.map((item, index) => ({
    exercise_id: item.exercise_id,
    display_order: index,
  }));
}

export function BankComposition({ exercises }: BankCompositionProps) {
  const form = useFormContext<BlockFormValues>();
  const bank = useWatch({ control: form.control, name: "bank" }) ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const exerciseById = useMemo(
    () =>
      new Map(exercises.map((exercise) => [exercise.exercise_id, exercise])),
    [exercises],
  );

  const setBank = (nextBank: BlockFormValues["bank"]) => {
    form.setValue("bank", normalizeBank(nextBank), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Bank composition
        </h2>
        <p className="text-sm text-muted-foreground">
          Reorder, remove, or add exercises. Changes save with the block.
        </p>
      </div>

      {bank.length > 0 ? (
        <ul className="space-y-3">
          {bank.map((item, index) => (
            <BankItemRow
              key={`${item.exercise_id}:${index}`}
              name={
                exerciseById.get(item.exercise_id)?.name ?? "Unknown exercise"
              }
              index={index}
              total={bank.length}
              onMoveUp={() => {
                if (index === 0) {
                  return;
                }

                const nextBank = [...bank];
                [nextBank[index - 1], nextBank[index]] = [
                  nextBank[index],
                  nextBank[index - 1],
                ];
                setBank(nextBank);
              }}
              onMoveDown={() => {
                if (index === bank.length - 1) {
                  return;
                }

                const nextBank = [...bank];
                [nextBank[index], nextBank[index + 1]] = [
                  nextBank[index + 1],
                  nextBank[index],
                ];
                setBank(nextBank);
              }}
              onRemove={() => {
                setBank(bank.filter((_, bankIndex) => bankIndex !== index));
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          No exercises in this bank yet.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setPickerOpen(true)}
      >
        Add exercise to bank
      </Button>

      <ExercisePicker
        exercises={exercises}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={bank.map((item) => item.exercise_id)}
        onSelect={(exerciseId) => {
          setBank([
            ...bank,
            { exercise_id: exerciseId, display_order: bank.length },
          ]);
        }}
      />
    </div>
  );
}
