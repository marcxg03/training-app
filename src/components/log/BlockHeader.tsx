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
  return blockType.charAt(0).toUpperCase() + blockType.slice(1);
}

export function BlockHeader({
  blockIndex,
  blockName,
  blockType,
  endSessionAction,
  totalBlocks,
}: BlockHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Block {blockIndex} of {totalBlocks}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {blockName}
        </h2>
        <span className="inline-flex min-h-7 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">
          {formatBlockType(blockType)}
        </span>
      </div>
      {endSessionAction}
    </div>
  );
}
