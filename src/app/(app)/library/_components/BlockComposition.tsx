"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { BlockPicker } from "@/app/(app)/library/_components/BlockPicker";
import { MoveButton } from "@/app/(app)/library/_components/MoveButton";
import { Button } from "@/components/ui/button";
import type { LiftingBlockSummary } from "@/lib/library/projections";
import type { WorkoutDefFormValues } from "@/lib/library/schemas";

type BlockCompositionProps = {
  blocks: LiftingBlockSummary[];
};

function normalizeBlocks(
  blocks: WorkoutDefFormValues["blocks"],
): WorkoutDefFormValues["blocks"] {
  return blocks.map((item, index) => ({
    block_id: item.block_id,
    display_order: index,
  }));
}

export function BlockComposition({ blocks }: BlockCompositionProps) {
  const form = useFormContext<WorkoutDefFormValues>();
  const selected = useWatch({ control: form.control, name: "blocks" }) ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.block_id, block])),
    [blocks],
  );

  const setBlocks = (next: WorkoutDefFormValues["blocks"]) => {
    form.setValue("blocks", normalizeBlocks(next), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Blocks</h2>
        <p className="text-sm text-muted-foreground">
          Reorder, remove, or add lifting blocks. Changes save with the workout.
        </p>
      </div>

      {selected.length > 0 ? (
        <ul className="space-y-3">
          {selected.map((item, index) => (
            <li
              key={`${item.block_id}:${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3"
            >
              <p className="min-w-0 truncate text-sm font-medium text-foreground">
                {blockById.get(item.block_id)?.block_name ?? "Unknown block"}
              </p>
              <div className="flex items-center gap-2">
                <MoveButton
                  direction="up"
                  disabled={index === 0}
                  onClick={() => {
                    if (index === 0) {
                      return;
                    }
                    const next = [...selected];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    setBlocks(next);
                  }}
                />
                <MoveButton
                  direction="down"
                  disabled={index === selected.length - 1}
                  onClick={() => {
                    if (index === selected.length - 1) {
                      return;
                    }
                    const next = [...selected];
                    [next[index], next[index + 1]] = [
                      next[index + 1],
                      next[index],
                    ];
                    setBlocks(next);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Remove block"
                  onClick={() => {
                    setBlocks(selected.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          No blocks in this workout yet.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setPickerOpen(true)}
      >
        Add block to workout
      </Button>

      <BlockPicker
        blocks={blocks}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={selected.map((item) => item.block_id)}
        onSelect={(blockId) => {
          setBlocks([
            ...selected,
            { block_id: blockId, display_order: selected.length },
          ]);
        }}
      />
    </div>
  );
}
