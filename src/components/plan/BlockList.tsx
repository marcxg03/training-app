"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { formatBlockType } from "@/lib/methodology/workout-state";
import { cn } from "@/lib/utils/cn";

type BlockListProps = {
  blocks: Array<{
    blockId: string;
    blockName: string;
    blockType: string;
    bank: ReactNode;
  }>;
};

export function BlockList({ blocks }: BlockListProps) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(
    blocks[0]?.blockId ?? null,
  );

  return (
    <div className="space-y-2.5">
      {blocks.map((block) => {
        const isOpen = openBlockId === block.blockId;

        return (
          <div
            key={block.blockId}
            className="overflow-hidden rounded-[14px] border border-border bg-card"
          >
            <button
              type="button"
              onClick={() =>
                setOpenBlockId((currentValue) =>
                  currentValue === block.blockId ? null : block.blockId,
                )
              }
              className="flex w-full items-center justify-between gap-3 px-[15px] py-[15px] text-left"
            >
              <span className="text-[15px] font-semibold text-foreground">
                {block.blockName}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
                  {formatBlockType(block.blockType)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-faint transition-transform",
                    isOpen ? "rotate-180" : "",
                  )}
                />
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-border/70 px-[15px] pb-[15px] pt-3">
                {block.bank}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
