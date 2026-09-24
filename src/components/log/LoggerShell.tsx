"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerWorkout,
  LoggerSetLog,
  WorkoutCompletionRecord,
} from "@/lib/methodology/workout-state";
import {
  findLastIncompleteBlock,
  formatBlockType,
  getSelectedExerciseIdForBlock,
  isBlockComplete,
} from "@/lib/methodology/workout-state";
import { createClient } from "@/lib/supabase/client";
import { isRetryable } from "@/lib/sync/classify";
import { drainQueue } from "@/lib/sync/drain";
import { enqueue } from "@/lib/sync/queue";
import { setupDrainTriggers } from "@/lib/sync/triggers";
import { cn } from "@/lib/utils/cn";
import { EndWorkoutDialog } from "@/components/log/EndWorkoutDialog";
import { ExercisePicker } from "@/components/log/ExercisePicker";
import { FailureProtocol } from "@/components/log/FailureProtocol";
import { FreeFormProtocol } from "@/components/log/FreeFormProtocol";
import { QueueIndicator } from "@/components/log/QueueIndicator";
import {
  WorkoutSummary,
  type WorkoutSummaryProps,
} from "@/components/log/WorkoutSummary";
import { AddExerciseSheet } from "@/components/log/AddExerciseSheet";

type LoggerShellProps = {
  blocks: LoggerBlock[];
  initialBlockIndex: number;
  session: LoggerWorkout;
  workoutCompletion: WorkoutCompletionRecord;
  /** Every exercise the user owns, for adding one mid-session. */
  exerciseCatalog: LoggerExercise[];
  userId: string;
};

function buildSelectedExerciseMap(blocks: LoggerBlock[]) {
  return Object.fromEntries(
    blocks
      .map(
        (block) =>
          [block.block_id, getSelectedExerciseIdForBlock(block)] as const,
      )
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function getBlockExercise(block: LoggerBlock, exerciseId: string | null) {
  if (!exerciseId) {
    return null;
  }

  return (
    block.exercises.find((exercise) => exercise.exercise_id === exerciseId) ??
    null
  );
}

function getQueueErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Local storage full — clear browser data or contact support";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not queue this write.";
}

function buildLocalSummary(
  blocks: LoggerBlock[],
  completedAt: string,
  workoutName: string,
  statusMessage: string,
  wasEndedEarly: boolean,
): WorkoutSummaryProps {
  const setLogs = blocks.flatMap((block) =>
    block.setLogs
      .slice()
      .sort((left, right) => left.set_index - right.set_index)
      .map((setLog) => {
        const exercise =
          block.exercises.find(
            (candidate) => candidate.exercise_id === setLog.exercise_id,
          ) ?? null;

        return {
          exerciseName: exercise?.name ?? "Unknown exercise",
          isBodyweight: exercise?.is_bodyweight ?? false,
          reps: setLog.reps,
          setLogId: setLog.set_log_id,
          weightKg: setLog.weight_kg,
        };
      }),
  );

  const prs = blocks.flatMap((block) =>
    block.setLogs.flatMap((setLog) => {
      const exercise =
        block.exercises.find(
          (candidate) => candidate.exercise_id === setLog.exercise_id,
        ) ?? null;

      return setLog.prTypes.map((prType) => ({
        exerciseName: exercise?.name ?? "Unknown exercise",
        prId: `${setLog.set_log_id}:${prType}`,
        prType,
        reps: setLog.reps,
        weightKg: setLog.weight_kg ?? 0,
      }));
    }),
  );

  return {
    completedAt,
    prs,
    workoutName,
    setLogs,
    statusMessage,
    wasEndedEarly,
  };
}

export function LoggerShell({
  blocks,
  initialBlockIndex,
  session,
  workoutCompletion,
  exerciseCatalog,
  userId,
}: LoggerShellProps) {
  const router = useRouter();
  const supabase = createClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [blocksState, setBlocksState] = useState(blocks);
  const [completedBlockIds, setCompletedBlockIds] = useState(
    workoutCompletion.completed_block_ids,
  );
  const [completedSummary, setCompletedSummary] =
    useState<WorkoutSummaryProps | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(initialBlockIndex);
  const [selectedExerciseByBlockId, setSelectedExerciseByBlockId] = useState(
    buildSelectedExerciseMap(blocks),
  );

  const blocksRef = useRef(blocks);
  const completedBlockIdsRef = useRef(workoutCompletion.completed_block_ids);

  useEffect(() => {
    void drainQueue(userId);

    const cleanup = setupDrainTriggers(userId);

    return cleanup;
  }, [userId]);

  function updateBlocks(nextBlocks: LoggerBlock[]) {
    blocksRef.current = nextBlocks;
    setBlocksState(nextBlocks);
  }

  function updateCompletedBlockIds(nextCompletedBlockIds: string[]) {
    completedBlockIdsRef.current = nextCompletedBlockIds;
    setCompletedBlockIds(nextCompletedBlockIds);
  }

  function handleSetSaved(
    blockId: string,
    exercise: LoggerExercise,
    setLog: LoggerSetLog,
  ) {
    setActionError(null);

    const nextBlocks = blocksRef.current.map((block) => {
      if (block.block_id !== blockId) {
        return block;
      }

      return {
        ...block,
        setLogs: [...block.setLogs, setLog].sort(
          (left, right) => left.set_index - right.set_index,
        ),
      };
    });

    updateBlocks(nextBlocks);
    setSelectedExerciseByBlockId((current) => ({
      ...current,
      [blockId]: exercise.exercise_id,
    }));
  }

  /** Adds an exercise to a block for THIS session only.
   *
   * Local state exclusively — nothing writes block_lifting_items, so the plan
   * is untouched. The set logged against it carries the exercise_id, and the
   * logger page unions that back in on reload. */
  function handleExerciseAdded(blockId: string, exercise: LoggerExercise) {
    setActionError(null);

    const nextBlocks = blocksRef.current.map((block) =>
      block.block_id === blockId &&
      !block.exercises.some((e) => e.exercise_id === exercise.exercise_id)
        ? { ...block, exercises: [...block.exercises, exercise] }
        : block,
    );

    updateBlocks(nextBlocks);
    setSelectedExerciseByBlockId((current) => ({
      ...current,
      [blockId]: exercise.exercise_id,
    }));
  }

  async function completeSession(
    wasEndedEarly: boolean,
    nextCompletedBlockIds: string[],
  ) {
    setActionError(null);
    const completedAt = new Date().toISOString();

    const { error, status } = await supabase
      .from("workout_completions")
      .update({
        completed_at: completedAt,
        completed_block_ids: nextCompletedBlockIds,
        was_ended_early: wasEndedEarly,
      })
      .eq("completion_id", workoutCompletion.completion_id);

    if (error) {
      if (
        isRetryable({
          code: error.code,
          message: error.message,
          status,
        })
      ) {
        try {
          enqueue(userId, {
            id: crypto.randomUUID(),
            kind: "workout_completion_end",
            payload: {
              completion_id: workoutCompletion.completion_id,
              completed_at: completedAt,
              completed_block_ids: nextCompletedBlockIds,
              was_ended_early: wasEndedEarly,
            },
            attempts: 0,
            enqueued_at: completedAt,
            last_attempt_at: null,
            last_error: null,
          });
        } catch (queueError) {
          throw new Error(getQueueErrorMessage(queueError));
        }

        updateCompletedBlockIds(nextCompletedBlockIds);
        setCompletedSummary(
          buildLocalSummary(
            blocksRef.current,
            completedAt,
            session.workout_name,
            "Workout saved locally. It will sync when you're back online.",
            wasEndedEarly,
          ),
        );
        return;
      }

      throw new Error(error.message);
    }

    router.refresh();
    router.push(
      `/log/${session.workout_id}/summary?completion_id=${workoutCompletion.completion_id}`,
    );
  }

  async function advanceToNextBlock(nextCompletedBlockIds: string[]) {
    const nextBlockIndex = findLastIncompleteBlock(
      blocksRef.current,
      nextCompletedBlockIds,
    );

    if (nextBlockIndex === -1) {
      await completeSession(false, nextCompletedBlockIds);
      return;
    }

    setCurrentBlockIndex(nextBlockIndex);
  }

  async function handleFreeFormComplete(blockId: string) {
    const nextCompletedBlockIds = Array.from(
      new Set([...completedBlockIdsRef.current, blockId]),
    );

    const completedAt = new Date().toISOString();
    const { error, status } = await supabase
      .from("workout_completions")
      .update({
        completed_block_ids: nextCompletedBlockIds,
      })
      .eq("completion_id", workoutCompletion.completion_id);

    if (error) {
      if (
        isRetryable({
          code: error.code,
          message: error.message,
          status,
        })
      ) {
        try {
          enqueue(userId, {
            id: crypto.randomUUID(),
            kind: "workout_completion_block_complete",
            payload: {
              completion_id: workoutCompletion.completion_id,
              block_id: blockId,
            },
            attempts: 0,
            enqueued_at: completedAt,
            last_attempt_at: null,
            last_error: null,
          });
        } catch (queueError) {
          throw new Error(getQueueErrorMessage(queueError));
        }

        updateCompletedBlockIds(nextCompletedBlockIds);
        await advanceToNextBlock(nextCompletedBlockIds);
        return;
      }

      throw new Error(error.message);
    }

    updateCompletedBlockIds(nextCompletedBlockIds);
    router.refresh();
    await advanceToNextBlock(nextCompletedBlockIds);
  }

  const currentBlock = blocksState[currentBlockIndex] ?? null;

  if (completedSummary) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex items-center justify-end">
          <QueueIndicator userId={userId} />
        </div>

        <WorkoutSummary {...completedSummary} />
      </div>
    );
  }

  const selectedExerciseId = currentBlock
    ? (selectedExerciseByBlockId[currentBlock.block_id] ??
      getSelectedExerciseIdForBlock(currentBlock))
    : null;
  const selectedExercise = currentBlock
    ? getBlockExercise(currentBlock, selectedExerciseId)
    : null;
  const rightLabel = currentBlock
    ? (selectedExercise?.name ?? formatBlockType(currentBlock.block_type))
    : "";

  // The whole-workout progress: each block is a segment — done (accent), the
  // current block (accent/40), or upcoming (input). Derived entirely from real
  // state (completedBlockIds + currentBlockIndex), never a hardcoded count.
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* Top bar: the two ways out, live sync indicator, block progress, label.
          EXIT and END are deliberately different things and are drawn as such
          (T2-D, Marcus: "give me the option to exit the workout without ending
          it"):
            ← Exit          — leave for now. A plain navigation to /today; it
                              writes NOTHING, so completed_at stays null and the
                              session is picked back up exactly where it was
                              (findLastIncompleteBlock resumes the block, the
                              logged sets reload with it).
            ✕ End workout   — finish the session. Unchanged behaviour: confirm
                              dialog, completed_at + was_ended_early written,
                              summary. Placed on the opposite side, in danger
                              color, so it cannot be mistaken for the back
                              chevron. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/today"
            className="inline-flex items-center gap-1 rounded-[10px] px-1 py-1 text-[13px] text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Exit
          </Link>
          <div className="flex items-center gap-3">
            <QueueIndicator userId={userId} />
            <EndWorkoutDialog
              onConfirm={() =>
                completeSession(true, completedBlockIdsRef.current)
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {blocksState.map((block, index) => {
            const isComplete = isBlockComplete(block, completedBlockIds);
            const isCurrent = index === currentBlockIndex;
            return (
              <span
                key={block.block_id}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  isComplete
                    ? "bg-accent"
                    : isCurrent
                      ? "bg-accent/40"
                      : "bg-input",
                )}
              />
            );
          })}
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            Block {currentBlockIndex + 1} / {blocksState.length}
            {currentBlock ? ` · ${currentBlock.block_name}` : ""}
          </span>
          <span className="shrink-0 truncate text-[11px] tabular-nums text-faint">
            {rightLabel}
          </span>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-danger">{actionError}</p>
      ) : null}

      {/* Single-block focus: only the current block is painted — you advance
          forward through the workout (completed/upcoming blocks live in the
          progress bar above). Every state transition is driven by the same
          handlers as before; only the presentation is recomposed. */}
      {currentBlock ? (
        <div key={currentBlock.block_id} className="flex flex-col gap-4">
          {/* The picker owns the swap affordance (T2-D). This handler is the
              SAME one a first selection uses — a swap is just another
              selection, and it writes nothing: set_logs stay attributed to the
              exercise they were logged under, and only the NEXT set goes to the
              new one. loggedSetCount is what tells the picker whether the swap
              is free or needs the confirm. */}
          <ExercisePicker
            exercises={currentBlock.exercises}
            selectedExerciseId={selectedExerciseId}
            loggedSetCount={currentBlock.setLogs.length}
            onSelect={(exercise) =>
              setSelectedExerciseByBlockId((current) => ({
                ...current,
                [currentBlock.block_id]: exercise.exercise_id,
              }))
            }
          />

          {/* Only while the block is still free: once a set is logged the
              block's exercise is fixed for the session, since every set in a
              block records against the one selected. */}
          {currentBlock.setLogs.length === 0 ? (
            <AddExerciseSheet
              catalog={exerciseCatalog}
              existingExerciseIds={currentBlock.exercises.map(
                (exercise) => exercise.exercise_id,
              )}
              userId={userId}
              onAdd={(exercise) =>
                handleExerciseAdded(currentBlock.block_id, exercise)
              }
            />
          ) : null}

          {selectedExercise ? (
            currentBlock.block_type === "failure" ? (
              <FailureProtocol
                block={currentBlock}
                completionId={workoutCompletion.completion_id}
                exercise={selectedExercise}
                workoutId={session.workout_id}
                userId={userId}
                onSetSaved={(setLog) =>
                  handleSetSaved(
                    currentBlock.block_id,
                    selectedExercise,
                    setLog,
                  )
                }
                onComplete={() => handleFreeFormComplete(currentBlock.block_id)}
              />
            ) : (
              <FreeFormProtocol
                block={currentBlock}
                completionId={workoutCompletion.completion_id}
                exercise={selectedExercise}
                workoutId={session.workout_id}
                userId={userId}
                onSetSaved={(setLog) =>
                  handleSetSaved(
                    currentBlock.block_id,
                    selectedExercise,
                    setLog,
                  )
                }
                onComplete={() => handleFreeFormComplete(currentBlock.block_id)}
              />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
