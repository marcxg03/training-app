"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import {
  getSchemeActions,
  getSetLabel,
  getSetSchemeSteps,
  nextAddedSetIndex,
  priorExerciseLabel,
} from "@/lib/methodology/workout-state";
import { SetRow } from "@/components/shared";
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

  const nextAddedIndex = nextAddedSetIndex(block);
  const { showAdd, showComplete } = getSchemeActions(block);

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
              exerciseName={priorExerciseLabel(
                block,
                savedSet.exercise_id,
                exercise.exercise_id,
              )}
            />
          );
        }

        if (!nextTargetStep || nextTargetStep.setIndex !== step.setIndex) {
          // A future target slot — a dashed placeholder that unlocks once the
          // prior set is saved (sequential unlock preserved).
          return (
            <SetRow
              key={step.setIndex}
              label={step.label}
              value="—"
              role="target"
            />
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
          exerciseName={priorExerciseLabel(
            block,
            setLog.exercise_id,
            exercise.exercise_id,
          )}
        />
      ))}

      {/* Once every target slot is logged, offer another working set (W3, W4…).
          The block NEVER auto-locks at the count — while adding, the pad takes
          the full width (not the side-by-side actions row). */}
      {showAdd && isAddingSet ? (
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
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Flexible scheme actions (D16): "+ Add working set" (dashed) appears only
          once the target slots are all logged; "Complete block" (solid) appears
          as soon as ≥1 working set is logged, so a weak day (1 of 2) can finish
          and advance — the target is soft BOTH ways. Never gated on the full
          target being met. */}
      {(showAdd && !isAddingSet) || showComplete ? (
        <div className="flex gap-2">
          {showAdd && !isAddingSet ? (
            <button
              type="button"
              onClick={() => setIsAddingSet(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:border-accent/50 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add working set
            </button>
          ) : null}
          {showComplete ? (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 text-[11px] font-bold uppercase tracking-[0.08em]"
            >
              {isCompleting ? "Saving…" : "Complete block ▸"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
