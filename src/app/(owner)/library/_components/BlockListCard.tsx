import { ChevronRight } from "lucide-react";

import type { LiftingBlockSummary } from "@/lib/library/projections";
import { BlockLink } from "@/components/shared/BlockLink";
import { BlockTypeBadge } from "@/app/(owner)/library/_components/BlockTypeBadge";

type BlockListCardProps = {
  block: LiftingBlockSummary;
};

export function BlockListCard({ block }: BlockListCardProps) {
  const exerciseCount = block.exercise_count;

  return (
    <li>
      <BlockLink
        blockId={block.block_id}
        className="flex min-h-11 items-center gap-3 rounded-[13px] border border-border bg-card px-[15px] py-3.5 transition-colors hover:border-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {block.block_name}
            </span>
            <BlockTypeBadge blockType={block.block_type} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] font-medium uppercase tabular-nums tracking-[0.1em] text-muted-foreground">
            {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"} in
            bank
          </p>
        </div>
        <ChevronRight className="h-5 w-5 flex-none text-ghost" />
      </BlockLink>
    </li>
  );
}
