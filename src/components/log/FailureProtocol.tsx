"use client";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { getSetSchemeSteps } from "@/lib/methodology/workout-state";
import { SetEntryForm } from "@/components/log/SetEntryForm";
import { SetLogRow } from "@/components/log/SetLogRow";

type FailureProtocolProps = {
  block: LoggerBlock;
  completionId: string;
  exercise: LoggerExercise;
  workoutId: string;
  userId: string;
  onComplete: () => void;
  onSetSaved: (setLog: LoggerSetLog) => void;
};

export function FailureProtocol({
  block,
  completionId,
  exercise,
  workoutId,
  userId,
  onComplete,
  onSetSaved,
}: FailureProtocolProps) {
  // Set slots come from the block's scheme (migration 025), not a fixed
  // WU/W1/W2 triple: N warm-ups then M working sets, the last carrying the
  // failure checkbox iff the block is toFailure.
  const failureSteps = getSetSchemeSteps(block);
  const lastSetIndex = failureSteps.length;
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
            completionId={completionId}
            exercise={exercise}
            label={step.label}
            workoutId={workoutId}
            setIndex={step.setIndex}
            showFailureCheckbox={step.showFailureCheckbox}
            defaultFailureChecked={step.showFailureCheckbox}
            userId={userId}
            onSaved={(setLog) => {
              onSetSaved(setLog);

              if (setLog.set_index === lastSetIndex) {
                onComplete();
              }
            }}
          />
        );
      })}
    </div>
  );
}
