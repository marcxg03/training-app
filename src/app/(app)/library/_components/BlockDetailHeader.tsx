import { ArrowLeft } from "lucide-react";

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
        aria-label="Back to library"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-input text-subtle transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </a>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {block.block_name}
          </h1>
          <BlockTypeBadge blockType={block.block_type} />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
          Bank · pick one per session
        </p>
      </div>
    </div>
  );
}
