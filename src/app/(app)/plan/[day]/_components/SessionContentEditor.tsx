"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useFieldArray, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityOption, BlockOption } from "@/lib/plan/projections";
import type { DayFormValues } from "@/lib/plan/schemas";

type SessionContentEditorProps = {
  control: Control<DayFormValues>;
  /** Index of the session this editor belongs to, within the day's array. */
  workoutIndex: number;
  workoutType: DayFormValues["workouts"][number]["workout_type"];
  /** Catalog-linked sessions own their blocks via the workout definition. */
  isCatalogLinked: boolean;
  /** Logged sessions keep the block snapshot their history was recorded
   * against — history counts read live workout_blocks. */
  hasHistory: boolean;
  blockCatalog: BlockOption[];
  cardioActivities: ActivityOption[];
  recoveryActivities: ActivityOption[];
};

const EMPTY_CATALOG_HINT =
  "Add one in the Library first, then it shows up here.";

/** Edits what a session actually contains.
 *
 * Two shapes, because the data has two shapes (see EditableBlockRow):
 *  - lifting  → an ordered list of Library blocks
 *  - cardio /
 *    recovery → a single category block carrying a preset activity
 *
 * Blocks are only ever attached here, never authored — authoring lives in the
 * Library, which already owns block names, uniqueness, and exercise lists. */
export function SessionContentEditor({
  control,
  workoutIndex,
  workoutType,
  isCatalogLinked,
  hasHistory,
  blockCatalog,
  cardioActivities,
  recoveryActivities,
}: SessionContentEditorProps) {
  const { fields, append, remove, move, replace } = useFieldArray({
    control,
    name: `workouts.${workoutIndex}.blocks`,
  });

  // Two owners other than this editor:
  //  - a catalog-linked session's blocks come from its workout definition and
  //    are re-materialized by the weekly plan editor;
  //  - a logged session's block list is the snapshot its history was recorded
  //    against, and /history reports counts against LIVE workout_blocks, so
  //    changing it retroactively corrupts past completions.
  // Both are enforced server-side in saveDay; this renders the truth.
  if (isCatalogLinked || hasHistory) {
    return (
      <div className="space-y-2">
        <p className="eyebrow">Blocks</p>
        {fields.length === 0 ? (
          <p className="text-[12px] text-faint">
            {isCatalogLinked
              ? "This workout’s definition has no blocks yet."
              : "This session was logged without any blocks."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {fields.map((field, blockIndex) => (
              <li
                key={field.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="font-mono text-[10px] text-faint">
                  {blockIndex + 1}
                </span>
                <span className="flex-1 truncate text-[13px] text-subtle">
                  {field.block_name}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-faint">
          {isCatalogLinked
            ? "From the workout catalog — edit its blocks in the Library."
            : "This session has logged history, so its blocks are frozen."}
        </p>
      </div>
    );
  }

  if (workoutType === "lifting") {
    const liftingBlocks = blockCatalog.filter(
      (block) => block.block_category === "lifting",
    );
    const attachedIds = new Set(fields.map((field) => field.block_id));
    const available = liftingBlocks.filter(
      (block) => !attachedIds.has(block.block_id),
    );

    return (
      <div className="space-y-2">
        <p className="eyebrow">Blocks</p>

        {fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[12px] text-subtle">
            No blocks yet — this session will open empty in the logger.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {fields.map((field, blockIndex) => (
              <li
                key={field.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="font-mono text-[10px] text-faint">
                  {blockIndex + 1}
                </span>
                <span className="flex-1 truncate text-[13px] text-foreground">
                  {field.block_name}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={blockIndex === 0}
                  onClick={() => move(blockIndex, blockIndex - 1)}
                  aria-label={`Move ${field.block_name} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={blockIndex === fields.length - 1}
                  onClick={() => move(blockIndex, blockIndex + 1)}
                  aria-label={`Move ${field.block_name} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => remove(blockIndex)}
                  aria-label={`Remove ${field.block_name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 ? (
          <Select
            // Remounts after each pick so the trigger returns to the
            // placeholder instead of showing the block just added.
            key={`add-${fields.length}`}
            onValueChange={(blockId) => {
              const block = available.find((b) => b.block_id === blockId);
              if (!block) {
                return;
              }
              append({
                block_id: block.block_id,
                block_name: block.block_name,
                preset_activity_id: null,
              });
            }}
          >
            <SelectTrigger
              aria-label="Add block"
              className="h-auto w-full justify-between rounded-lg border-dashed border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-subtle"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <SelectValue placeholder="Add block" />
              </span>
            </SelectTrigger>
            <SelectContent>
              {available.map((block) => (
                <SelectItem key={block.block_id} value={block.block_id}>
                  {block.block_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-[12px] text-faint">
            {liftingBlocks.length === 0
              ? `No lifting blocks in your Library. ${EMPTY_CATALOG_HINT}`
              : "Every Library block is already in this session."}
          </p>
        )}
      </div>
    );
  }

  // --- cardio / recovery: one category block carrying a preset activity ---
  const activities =
    workoutType === "cardio" ? cardioActivities : recoveryActivities;
  // Prefer the block already attached: picking blockCatalog's first match would
  // silently relink the session to a different block for anyone whose Library
  // holds more than one block of this category.
  const attachedId = fields[0]?.block_id;
  const categoryBlock =
    blockCatalog.find(
      (block) =>
        block.block_id === attachedId && block.block_category === workoutType,
    ) ?? blockCatalog.find((block) => block.block_category === workoutType);
  const selectedActivityId = fields[0]?.preset_activity_id ?? "";

  if (!categoryBlock) {
    return (
      <div className="space-y-2">
        <p className="eyebrow">Activity</p>
        <p className="text-[12px] text-faint">
          {`No ${workoutType} block in your Library. ${EMPTY_CATALOG_HINT}`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="eyebrow">Activity</p>
      {activities.length === 0 ? (
        <p className="text-[12px] text-faint">
          {`No ${workoutType} activities in your Library. ${EMPTY_CATALOG_HINT}`}
        </p>
      ) : (
        <Select
          value={selectedActivityId}
          onValueChange={(activityId) =>
            // Always exactly one row for these session types — replace, don't
            // append, so switching activity can't stack duplicates.
            replace([
              {
                block_id: categoryBlock.block_id,
                block_name: categoryBlock.block_name,
                preset_activity_id: activityId,
              },
            ])
          }
        >
          <SelectTrigger
            aria-label="Activity"
            className="h-auto w-full justify-between rounded-lg border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground"
          >
            <SelectValue placeholder="Pick an activity" />
          </SelectTrigger>
          <SelectContent>
            {activities.map((activity) => (
              <SelectItem
                key={activity.activity_id}
                value={activity.activity_id}
              >
                {activity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
