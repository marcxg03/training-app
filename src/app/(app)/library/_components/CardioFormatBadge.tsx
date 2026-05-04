import type { CardioActivity } from "@/lib/library/projections";
import { formatCardioFormatLabel } from "@/lib/library/displayName";

type CardioFormatBadgeProps = {
  cardioFormat: CardioActivity["cardio_format"];
};

export function CardioFormatBadge({ cardioFormat }: CardioFormatBadgeProps) {
  return (
    <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {formatCardioFormatLabel(cardioFormat)}
    </span>
  );
}
