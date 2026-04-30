"use client";

import { useState, type ReactNode } from "react";

type BlockListProps = {
  blocks: Array<{
    blockId: string;
    blockName: string;
    blockType: string;
    bank: ReactNode;
  }>;
};

function formatBlockType(blockType: string) {
  return blockType.replace(/_/g, " ");
}

export function BlockList({ blocks }: BlockListProps) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(
    blocks[0]?.blockId ?? null,
  );

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const isOpen = openBlockId === block.blockId;

        return (
          <div
            key={block.blockId}
            className="overflow-hidden rounded-2xl border border-border/80 bg-background/50"
          >
            <button
              type="button"
              onClick={() =>
                setOpenBlockId((currentValue) =>
                  currentValue === block.blockId ? null : block.blockId,
                )
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Block {index + 1}
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {block.blockName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatBlockType(block.blockType)}
                </p>
                <p className="mt-2 text-sm text-accent">
                  {isOpen ? "Hide Bank" : "Show Bank"}
                </p>
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-border/70 p-4">{block.bank}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
