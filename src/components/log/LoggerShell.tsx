"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  LoggerBlock,
  LoggerExercise,
  LoggerSession,
  LoggerSetLog,
  SessionCompletionRecord,
} from "@/lib/methodology/session-state";
import {
  findLastIncompleteBlock,
  getSelectedExerciseIdForBlock,
  isBlockComplete,
} from "@/lib/methodology/session-state";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { BlockHeader } from "@/components/log/BlockHeader";
import { EndSessionDialog } from "@/components/log/EndSessionDialog";
import { ExercisePicker } from "@/components/log/ExercisePicker";
import { FailureProtocol } from "@/components/log/FailureProtocol";
import { FreeFormProtocol } from "@/components/log/FreeFormProtocol";
import { SetLogRow } from "@/components/log/SetLogRow";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type LoggerShellProps = {
  blocks: LoggerBlock[];
  initialBlockIndex: number;
  session: LoggerSession;
  sessionCompletion: SessionCompletionRecord;
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

export function LoggerShell({
  blocks,
  initialBlockIndex,
  session,
  sessionCompletion,
  userId,
}: LoggerShellProps) {
  const router = useRouter();
  const supabase = createClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [blocksState, setBlocksState] = useState(blocks);
  const [completedBlockIds, setCompletedBlockIds] = useState(
    sessionCompletion.completed_block_ids,
  );
  const [currentBlockIndex, setCurrentBlockIndex] = useState(initialBlockIndex);
  const [selectedExerciseByBlockId, setSelectedExerciseByBlockId] = useState(
    buildSelectedExerciseMap(blocks),
  );

  const blocksRef = useRef(blocks);
  const completedBlockIdsRef = useRef(sessionCompletion.completed_block_ids);

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

  async function completeSession(
    wasEndedEarly: boolean,
    nextCompletedBlockIds: string[],
  ) {
    setActionError(null);

    const { error } = await supabase
      .from("session_completions")
      .update({
        completed_at: new Date().toISOString(),
        completed_block_ids: nextCompletedBlockIds,
        was_ended_early: wasEndedEarly,
      })
      .eq("completion_id", sessionCompletion.completion_id);

    if (error) {
      throw new Error(error.message);
    }

    router.refresh();
    router.push(
      `/log/${session.session_id}/summary?completion_id=${sessionCompletion.completion_id}`,
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

    const { error } = await supabase
      .from("session_completions")
      .update({
        completed_block_ids: nextCompletedBlockIds,
      })
      .eq("completion_id", sessionCompletion.completion_id);

    if (error) {
      throw new Error(error.message);
    }

    updateCompletedBlockIds(nextCompletedBlockIds);
    router.refresh();
    await advanceToNextBlock(nextCompletedBlockIds);
  }

  const currentBlock = blocksState[currentBlockIndex] ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Workout Logger
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {session.session_name}
        </h1>
      </div>

      {actionError ? (
        <p className="text-sm text-danger">{actionError}</p>
      ) : null}

      {blocksState.map((block, index) => {
        const isCurrent = currentBlock?.block_id === block.block_id;
        const isComplete = isBlockComplete(block, completedBlockIds);
        const selectedExerciseId =
          selectedExerciseByBlockId[block.block_id] ??
          getSelectedExerciseIdForBlock(block);
        const selectedExercise = getBlockExercise(block, selectedExerciseId);

        return (
          <Card
            key={block.block_id}
            className={cn(
              "bg-card/80",
              index > currentBlockIndex && !isComplete ? "opacity-70" : "",
            )}
          >
            <CardHeader className="space-y-4">
              <BlockHeader
                blockIndex={index + 1}
                blockName={block.block_name}
                blockType={block.block_type}
                totalBlocks={blocksState.length}
                endSessionAction={
                  isCurrent ? (
                    <EndSessionDialog
                      onConfirm={() =>
                        completeSession(true, completedBlockIdsRef.current)
                      }
                    />
                  ) : null
                }
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {isCurrent ? (
                <>
                  <ExercisePicker
                    exercises={block.exercises}
                    selectedExerciseId={selectedExerciseId}
                    onSelect={(exercise) =>
                      setSelectedExerciseByBlockId((current) => ({
                        ...current,
                        [block.block_id]: exercise.exercise_id,
                      }))
                    }
                  />

                  {selectedExercise ? (
                    block.block_type === "failure" ? (
                      <FailureProtocol
                        block={block}
                        exercise={selectedExercise}
                        sessionId={session.session_id}
                        userId={userId}
                        onSetSaved={(setLog) =>
                          handleSetSaved(
                            block.block_id,
                            selectedExercise,
                            setLog,
                          )
                        }
                        onComplete={() => {
                          void advanceToNextBlock(
                            completedBlockIdsRef.current,
                          ).catch((error: unknown) => {
                            const message =
                              error instanceof Error
                                ? error.message
                                : "Could not advance to the next block.";

                            setActionError(message);
                          });
                        }}
                      />
                    ) : (
                      <FreeFormProtocol
                        block={block}
                        exercise={selectedExercise}
                        sessionId={session.session_id}
                        userId={userId}
                        onSetSaved={(setLog) =>
                          handleSetSaved(
                            block.block_id,
                            selectedExercise,
                            setLog,
                          )
                        }
                        onComplete={() =>
                          handleFreeFormComplete(block.block_id)
                        }
                      />
                    )
                  ) : null}
                </>
              ) : selectedExercise ? (
                <>
                  <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {selectedExercise.name}
                    </p>
                  </div>
                  {block.setLogs.length > 0 ? (
                    <div className="space-y-3">
                      {block.setLogs
                        .slice()
                        .sort((left, right) => left.set_index - right.set_index)
                        .map((setLog) => (
                          <SetLogRow
                            key={setLog.set_log_id}
                            label={
                              block.block_type === "failure"
                                ? (["WU", "W1", "W2"][setLog.set_index - 1] ??
                                  `Set ${setLog.set_index}`)
                                : `Set ${setLog.set_index}`
                            }
                            setLog={setLog}
                            exercise={selectedExercise}
                          />
                        ))}
                    </div>
                  ) : isComplete ? (
                    <p className="text-sm text-muted-foreground">
                      Completed without logged sets.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No sets logged yet.
                    </p>
                  )}
                </>
              ) : isComplete ? (
                <p className="text-sm text-muted-foreground">
                  Completed without a selected exercise.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Up next after the current block.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
