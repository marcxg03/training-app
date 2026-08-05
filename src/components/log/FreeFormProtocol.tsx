"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSetLog,
} from "@/lib/methodology/workout-state";
import { Button } from "@/components/ui/button";
import { SetEntryForm } from "@/components/log/SetEntryForm";
import { SetLogRow } from "@/components/log/SetLogRow";

type FreeFormProtocolProps = {
  block: LoggerBlock;
  completionId: string;
  exercise: LoggerExercise;
  workoutId: string;
  userId: string;
  onComplete: () => Promise<void>;
  onSetSaved: (setLog: LoggerSetLog) => void;
};

export function FreeFormProtocol({
  block,
  completionId,
  exercise,
  workoutId,
  userId,
  onComplete,
  onSetSaved,
}: FreeFormProtocolProps) {
  const loggedSets = [...block.setLogs].sort(
    (left, right) => left.set_index - right.set_index,
  );
  const [error, setError] = useState<string | null>(null);
  const [isAddingSet, setIsAddingSet] = useState(loggedSets.length === 0);
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
      {loggedSets.map((setLog) => (
        <SetLogRow
          key={setLog.set_log_id}
          label={`Set ${setLog.set_index}`}
          setLog={setLog}
          exercise={exercise}
        />
      ))}

      {isAddingSet ? (
        <SetEntryForm
          blockId={block.block_id}
          completionId={completionId}
          exercise={exercise}
          label={`Set ${loggedSets.length + 1}`}
          workoutId={workoutId}
          setIndex={loggedSets.length + 1}
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
          Add set
        </Button>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        type="button"
        onClick={handleComplete}
        disabled={isCompleting}
        className="w-full text-[13px] font-bold uppercase tracking-[0.08em]"
      >
        {isCompleting ? "Saving…" : "Done with this block"}
      </Button>
    </div>
  );
}
