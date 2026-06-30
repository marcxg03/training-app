"use client";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { SetEntryForm } from "@/components/log/SetEntryForm";
import { SetLogRow } from "@/components/log/SetLogRow";

type FailureProtocolProps = {
  block: LoggerBlock;
  exercise: LoggerExercise;
  workoutId: string;
  userId: string;
  onComplete: () => void;
  onSetSaved: (setLog: LoggerSetLog) => void;
};

const failureSteps = [
  { label: "WU", setIndex: 1 },
  { label: "W1", setIndex: 2 },
  { label: "W2", setIndex: 3 },
] as const;

export function FailureProtocol({
  block,
  exercise,
  workoutId,
  userId,
  onComplete,
  onSetSaved,
}: FailureProtocolProps) {
  const loggedSets = [...block.setLogs].sort(
    (left, right) => left.set_index - right.set_index,
  );
  const nextStep = failureSteps.find(
    (step) => !loggedSets.some((setLog) => setLog.set_index === step.setIndex),
  );

  return (
    <div className="space-y-4">
      {failureSteps.map((step) => {
        const savedSet = loggedSets.find(
          (setLog) => setLog.set_index === step.setIndex,
        );

        if (savedSet) {
          return (
            <SetLogRow
              key={step.setIndex}
              label={step.label}
              setLog={savedSet}
              exercise={exercise}
            />
          );
        }

        if (!nextStep || nextStep.setIndex !== step.setIndex) {
          return (
            <div
              key={step.setIndex}
              className="rounded-xl border border-dashed border-border px-4 py-5 text-center font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint"
            >
              {step.label} unlocks after the prior set is saved
            </div>
          );
        }

        return (
          <SetEntryForm
            key={step.setIndex}
            blockId={block.block_id}
            exercise={exercise}
            label={step.label}
            workoutId={workoutId}
            setIndex={step.setIndex}
            showFailureCheckbox={step.setIndex === 3}
            defaultFailureChecked={step.setIndex === 3}
            userId={userId}
            onSaved={(setLog) => {
              onSetSaved(setLog);

              if (setLog.set_index === 3) {
                onComplete();
              }
            }}
          />
        );
      })}
    </div>
  );
}
