"use client";

import { useMemo } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatExerciseCount } from "@/lib/library/displayName";
import type { LiftingBlockSummary } from "@/lib/library/projections";

type BlockPickerProps = {
  blocks: LiftingBlockSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onSelect: (blockId: string) => void;
};

const BLOCK_TYPE_LABEL: Record<LiftingBlockSummary["block_type"], string> = {
  failure: "Failure",
  mobility: "Mobility",
  corrective: "Corrective",
};

export function BlockPicker({
  blocks,
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: BlockPickerProps) {
  const filteredBlocks = useMemo(() => {
    const excluded = new Set(excludeIds);
    return blocks.filter((block) => !excluded.has(block.block_id));
  }, [blocks, excludeIds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add block to workout</SheetTitle>
          <SheetDescription>
            Pick a lifting block. Create new blocks in the Lifting tab.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Command className="rounded-xl border border-border/70">
            <CommandInput placeholder="Search blocks..." />
            <CommandList>
              <CommandEmpty>No blocks available.</CommandEmpty>
              <CommandGroup heading="Lifting blocks">
                {filteredBlocks.map((block) => (
                  <CommandItem
                    key={block.block_id}
                    onSelect={() => {
                      onSelect(block.block_id);
                      onOpenChange(false);
                    }}
                  >
                    <div>
                      <p className="font-medium">{block.block_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {BLOCK_TYPE_LABEL[block.block_type]} ·{" "}
                        {formatExerciseCount(block.exercise_count)}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </SheetContent>
    </Sheet>
  );
}
