import type { LiftingBlockDetail } from "@/lib/library/projections";
import { liftingHref } from "@/lib/library/crossLinks";
import { BlockTypeBadge } from "@/app/(app)/library/_components/BlockTypeBadge";

type BlockDetailHeaderProps = {
  block: LiftingBlockDetail;
};

export function BlockDetailHeader({ block }: BlockDetailHeaderProps) {
  return (
    <div className="space-y-3">
      <a
        href={liftingHref()}
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent transition-colors hover:text-accent/80"
      >
        Back to library
      </a>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {block.block_name}
          </h1>
        </div>
        <BlockTypeBadge blockType={block.block_type} />
      </div>
    </div>
  );
}
