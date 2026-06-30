import type { ReactNode } from "react";

import type { Enums } from "@/lib/supabase/types";

type BlockHeaderProps = {
  blockIndex: number;
  blockName: string;
  blockType: Enums<"block_type_enum">;
  endSessionAction?: ReactNode;
  totalBlocks: number;
};

function formatBlockType(blockType: Enums<"block_type_enum">) {
  return blockType.replace(/_/g, "-").toUpperCase();
}

export function BlockHeader({
  blockIndex,
  blockName,
  blockType,
  endSessionAction,
  totalBlocks,
}: BlockHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Block {blockIndex} of {totalBlocks}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {formatBlockType(blockType)}
          </span>
          {endSessionAction}
        </div>
      </div>
      <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
        {blockName}
      </h2>
      <div className="flex gap-1.5">
        {Array.from({ length: totalBlocks }).map((_, index) => (
          <span
            key={index}
            className={
              index < blockIndex
                ? "h-1 flex-1 rounded-full bg-accent"
                : "h-1 flex-1 rounded-full bg-border"
            }
          />
        ))}
      </div>
    </div>
  );
}
