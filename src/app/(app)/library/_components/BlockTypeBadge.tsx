import type {
  LiftingBlockDetail,
  LiftingBlockSummary,
} from "@/lib/library/projections";

type BlockTypeBadgeProps = {
  blockType:
    | LiftingBlockSummary["block_type"]
    | LiftingBlockDetail["block_type"];
};

const labels: Record<BlockTypeBadgeProps["blockType"], string> = {
  failure: "Failure",
  mobility: "Mobility",
  corrective: "Corrective",
};

export function BlockTypeBadge({ blockType }: BlockTypeBadgeProps) {
  return (
    <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {labels[blockType]}
    </span>
  );
}
