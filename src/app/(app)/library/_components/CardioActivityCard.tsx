import { EditPencilButton } from "@/app/(app)/library/_components/EditPencilButton";
import type { CardioActivity } from "@/lib/library/projections";
import { formatCardioSummary } from "@/lib/library/displayName";
import { CardioFormatBadge } from "@/app/(app)/library/_components/CardioFormatBadge";

type CardioActivityCardProps = {
  activity: CardioActivity;
};

export function CardioActivityCard({ activity }: CardioActivityCardProps) {
  const summary = formatCardioSummary(activity);

  return (
    <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {activity.name}
          </p>
          {summary ? (
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <CardioFormatBadge cardioFormat={activity.cardio_format} />
          <EditPencilButton kind="cardio" activity={activity} />
        </div>
      </div>
      {activity.description ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {activity.description}
        </p>
      ) : null}
    </li>
  );
}
