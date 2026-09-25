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
    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
      {labels[blockType]}
    </span>
  );
}
