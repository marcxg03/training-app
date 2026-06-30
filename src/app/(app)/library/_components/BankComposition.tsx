"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { BankItemRow } from "@/app/(app)/library/_components/BankItemRow";
import { ExercisePicker } from "@/app/(app)/library/_components/ExercisePicker";
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
    <div className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          Bank — pick-from exercises
        </h2>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-accent transition-colors hover:text-accent/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {bank.length > 0 ? (
        <ul className="space-y-2">
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
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No exercises in this bank yet.
        </p>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full rounded-xl border border-dashed border-ghost px-4 py-3.5 text-center text-[13px] font-semibold text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
      >
        + Add exercise to bank
      </button>

      <p className="text-center font-mono text-[11px] uppercase tracking-[0.04em] text-faint">
        Checked = in the bank · use the arrows to reorder
      </p>

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
