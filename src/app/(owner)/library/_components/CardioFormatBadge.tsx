import type { CardioActivity } from "@/lib/library/projections";
import { formatCardioFormatLabel } from "@/lib/library/displayName";

type CardioFormatBadgeProps = {
  cardioFormat: CardioActivity["cardio_format"];
};

export function CardioFormatBadge({ cardioFormat }: CardioFormatBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-md border border-cardio/40 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-cardio">
      {formatCardioFormatLabel(cardioFormat)}
    </span>
  );
}
