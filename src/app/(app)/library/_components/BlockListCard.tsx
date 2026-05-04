import type { LiftingBlockSummary } from "@/lib/library/projections";
import { formatExerciseCount } from "@/lib/library/displayName";
import { BlockLink } from "@/components/shared/BlockLink";
import { BlockTypeBadge } from "@/app/(app)/library/_components/BlockTypeBadge";

type BlockListCardProps = {
  block: LiftingBlockSummary;
};

export function BlockListCard({ block }: BlockListCardProps) {
  return (
    <li>
      <BlockLink
        blockId={block.block_id}
        className="block rounded-2xl border border-border/70 bg-card/80 px-4 py-4 transition-colors hover:border-accent/40"
      >
        <div className="flex min-h-11 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {block.block_name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatExerciseCount(block.exercise_count)}
            </p>
          </div>
          <BlockTypeBadge blockType={block.block_type} />
        </div>
      </BlockLink>
    </li>
  );
}
