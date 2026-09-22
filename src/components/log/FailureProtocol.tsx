"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import {
  getSetLabel,
  getSetSchemeSteps,
} from "@/lib/methodology/workout-state";
import { Button } from "@/components/ui/button";
import { SetEntryForm } from "@/components/log/SetEntryForm";
import { SetLogRow } from "@/components/log/SetLogRow";

type FailureProtocolProps = {
  block: LoggerBlock;
  completionId: string;
  exercise: LoggerExercise;
  workoutId: string;
  userId: string;
  onComplete: () => Promise<void>;
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
  // D16: `working_sets` is a SOFT TARGET. Set slots come from the block's scheme
  // (migration 025) — N warm-ups then M target working sets, the last carrying
  // the failure checkbox iff the block is toFailure. Once the target is met the
  // block does NOT auto-complete: the user may add further working sets (W3, W4…)
  // and completes the block only via the explicit "Complete block" action.
  const targetSteps = getSetSchemeSteps(block);
  const targetCount = block.warmupSets + block.workingSets;
  const loggedSets = [...block.setLogs].sort(
    (left, right) => left.set_index - right.set_index,
  );

  // Working sets logged beyond the scheme's target slots.
  const addedSets = loggedSets.filter(
    (setLog) => setLog.set_index > targetCount,
  );

  // The next unlogged TARGET slot (sequential unlock). Undefined once the whole
  // target scheme is logged — that's when the add/complete affordances appear.
  const nextTargetStep = targetSteps.find(
    (step) => !loggedSets.some((setLog) => setLog.set_index === step.setIndex),
  );
  const targetComplete = !nextTargetStep;

  const maxLoggedIndex = loggedSets.reduce(
    (max, setLog) => Math.max(max, setLog.set_index),
    0,
  );
  const nextAddedIndex = Math.max(maxLoggedIndex + 1, targetCount + 1);

  const [error, setError] = useState<string | null>(null);
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  async function handleComplete() {
    setError(null);
    setIsCompleting(true);

    try {
      await onComplete();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Could not finish this block right now.";

      setError(message);
      setIsCompleting(false);
      return;
    }

    setIsCompleting(false);
  }

  return (
    <div className="space-y-4">
      {targetSteps.map((step) => {
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

        if (!nextTargetStep || nextTargetStep.setIndex !== step.setIndex) {
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
            onSaved={(setLog) => onSetSaved(setLog)}
          />
        );
      })}

      {/* Added working sets beyond the target keep the W-numbering (W3, W4…). */}
      {addedSets.map((setLog) => (
        <SetLogRow
          key={setLog.set_log_id}
          label={getSetLabel(block, setLog.set_index)}
          setLog={setLog}
          exercise={exercise}
        />
      ))}

      {/* Once every target slot is logged: offer another working set and the
          manual completion action. The block NEVER auto-locks at the count. */}
      {targetComplete ? (
        <>
          {isAddingSet ? (
            <SetEntryForm
              blockId={block.block_id}
              completionId={completionId}
              exercise={exercise}
              label={getSetLabel(block, nextAddedIndex)}
              workoutId={workoutId}
              setIndex={nextAddedIndex}
              showFailureCheckbox={block.toFailure}
              defaultFailureChecked={block.toFailure}
              userId={userId}
              onSaved={(setLog) => {
                onSetSaved(setLog);
                setIsAddingSet(false);
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddingSet(true)}
              className="w-full gap-2 uppercase tracking-[0.06em]"
            >
              <Plus className="h-4 w-4" />
              Add working set
            </Button>
          )}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button
            type="button"
            onClick={handleComplete}
            disabled={isCompleting}
            className="w-full text-[13px] font-bold uppercase tracking-[0.08em]"
          >
            {isCompleting ? "Saving…" : "Complete block"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
