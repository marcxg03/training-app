"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { BlockPicker } from "@/app/(owner)/library/_components/BlockPicker";
import { MoveButton } from "@/app/(owner)/library/_components/MoveButton";
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
    <div className="space-y-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
        Blocks — in order
      </h2>

      {selected.length > 0 ? (
        <ul className="space-y-2">
          {selected.map((item, index) => {
            const block = blockById.get(item.block_id);
            const exerciseCount = block?.exercise_count ?? 0;

            return (
              <li
                key={`${item.block_id}:${index}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card-alt px-3.5 py-3"
              >
                <span className="w-3.5 flex-none font-mono text-xs font-semibold tabular-nums text-faint">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {block?.block_name ?? "Unknown block"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tabular-nums tracking-[0.08em] text-muted-foreground">
                    {exerciseCount} in bank
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
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
                  <button
                    type="button"
                    aria-label="Remove block"
                    onClick={() => {
                      setBlocks(selected.filter((_, i) => i !== index));
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-danger/80 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No blocks in this workout yet.
        </p>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full rounded-xl border border-dashed border-ghost px-4 py-3.5 text-center text-[13px] font-semibold text-subtle transition-colors hover:border-accent/50 hover:text-foreground"
      >
        + Add block from library
      </button>

      <p className="text-center font-mono text-[11px] uppercase tracking-[0.04em] text-faint">
        Pick blocks you already built
      </p>

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
